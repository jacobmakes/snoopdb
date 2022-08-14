import * as fs from 'fs'
import * as path from 'path'
import * as stream from 'stream'
import * as os from 'os'
import { Buffer } from 'buffer'
import { stringify } from 'querystring'
import { EventEmitter } from 'stream'

const ID_SIZE = 0
console.time()

type rP = Parameters<typeof fs.createReadStream>
function readBinary(path: rP[0], options?: rP[1]) {
    const str = fs.createReadStream(path, options)
    // const str= fs.createReadStream('myBinaryFile'); //B
    let chunks = ''
    str.on('data', (chunk) => (chunks += chunk.toString('utf-8'))) //A & B
    str.on('end', () => console.log('ll', chunks, chunks.length)) //A 5.609ms
}
function calculateRowSize(schema: schema) {
    let bytes = ID_SIZE
    for (const col of schema) {
        switch (col[1]) {
            case 'string':
                bytes += col[2]
                break
            case 'int':
                bytes += col[2]
                break

            default:
                break
        }
    }
    return bytes
}

//array format [type,max value,]
//console.log(os.endianness())
const colTypes = ['string', 'int']

type column = [string, string, number]

type schema = column[]
type row = (string | number)[]
interface queueItem {
    type: string
    data?: Buffer
    symbol?: Symbol
}

class Table extends EventEmitter {
    protected start: number
    protected rowSize: number
    private queue: queueItem[]
    private locked: boolean
    private writeStream
    private rows: number

    constructor(
        readonly path: string,
        readonly name: string,
        private columns?: schema,
        private config?: any
    ) {
        super()
        this.queue = []
        this.locked = false
        //check if table exists

        //if table exist throw error if columns provided

        //create table
        /* Table form bytes, reason */
        // 4 location data starts
        // 4 version number'
        // 4 schemaEnd
        // ? schema
        // ? other
        if (!columns) {
            throw 'Table Schema undefined'
        }
        columns.forEach((col) => {
            if (!colTypes.includes(col[1])) {
                throw `invalid type ${col[1]} acceptable types: ${colTypes.join('","')}`
            }
        })

        const schemaLength = Buffer.from(JSON.stringify(schema)).length
        const START = 60
        const VERSION = 1
        const SCHEMA_END = schemaLength + 12
        const headers = Buffer.alloc(START)
        headers.writeInt32LE(START)
        headers.writeInt32LE(VERSION, 4)
        headers.writeInt32LE(SCHEMA_END, 8)
        headers.write(JSON.stringify(schema), 12)
        // const wstream = fs.createWriteStream(this.path, { encoding: 'binary' })
        // wstream.write(headers, () =>
        // )
        // wstream.end()
        fs.writeFileSync(this.path, headers, { encoding: 'binary' })
        // readBinary(this.path, {
        //     start: 12,
        //     end: SCHEMA_END - 1,
        // })
        this.start = START
        //@ts-ignore
        this.rowSize = calculateRowSize(this.columns)
        console.log(headers)
        this.rows = 0
        this.writeStream = fs.createWriteStream(this.path, { encoding: 'binary', flags: 'a' })
    }
    private add(item: queueItem) {
        this.locked ? this.queue.push(item) : this.process(item)
    }
    private process(newItem?: queueItem) {
        this.locked = true
        //console.log('que', this.queue, newItem)

        if (newItem) this.queue.push(newItem)
        //console.log('que2', this.queue)
        if (this.queue.length == 0) return
        const item = this.queue.shift()
        switch (item.type) {
            case 'addRow':
                this.addRow(item)
                break

            default:
                break
        }
        this.locked = false
        this.process()
        this.locked = false
    }
    private addRow({ data: buff, symbol }: queueItem) {
        //const { size } = fs.statSync(this.path)
        //const rowCount = (size - this.start) / this.rowSize
        const rowCount = this.rows++

        //console.log(size, this.start, this.rowSize, rowCount)
        if (!Number.isInteger(rowCount)) throw 'non integer rowCount'
        if (ID_SIZE > 0) {
            const tempBuff = Buffer.allocUnsafe(ID_SIZE)
            tempBuff.writeIntLE(rowCount + 1, 0, ID_SIZE)
            buff = Buffer.concat([tempBuff, buff])
        }
        // fs.appendFileSync(this.path, buff, { encoding: 'binary' })
        // this.emit(symbol, rowCount + 1)
        this.writeStream.write(buff, () => this.emit(symbol, rowCount + 1))
    }
    public async push(row: row) {
        //check size matches
        return new Promise(async (resolve, reject) => {
            if (row.length !== this.columns?.length) {
                throw 'row.length must match schema.length. row:' + row
            }
            const buffers: Buffer[] = []

            for (let i = 0; i < row.length; i++) {
                //check val correct size
                let buff: Buffer
                switch (this.columns[i][1]) {
                    case 'string':
                        //@ts-ignore
                        const stringBuff = Buffer.from(row[i])
                        if (stringBuff.length > this.columns[i][2]) {
                            throw 'row.length must match schema.length'
                        }
                        buff = Buffer.alloc(this.columns[i][2])
                        stringBuff.copy(buff)
                        break
                    case 'int':
                        if (!Number.isInteger(row[i])) throw 'non integer value: ' + row[i]
                        buff = Buffer.allocUnsafe(this.columns[i][2])
                        //@ts-ignore
                        buff.writeIntLE(row[i], 0, this.columns[i][2])
                        break
                    default:
                        console.error(this.columns[i][1])
                        throw 'no type match found'
                }
                buffers.push(buff)
            }
            const newRow = Buffer.concat(buffers)
            const padding = this.rowSize - newRow.length - ID_SIZE //4 for id
            //final reduntant check
            if (padding < 0) {
                throw 'row too large'
            }
            const symbol = Symbol()
            this.on(symbol, (id) => {
                // console.log('listening', id)
                // console.timeLog()
                const out: { [key: string]: any } = { id }
                for (let i = 0; i < row.length; i++) {
                    out[this.columns[i][1]] = row[i]
                }
                resolve(out)
            })
            this.add({
                type: 'addRow',
                data: Buffer.concat([newRow, Buffer.alloc(padding)]),
                symbol,
            })
        })
    }
    public async read(id: number) {
        return new Promise(async (resolve, reject) => {
            const offset = (id - 1) * this.rowSize + this.start
            const str = fs.createReadStream(this.path, {
                start: offset,
                end: offset + this.rowSize - 1,
                highWaterMark: this.rowSize + 1,
            })
            let chunks = []
            str.on('data', (chunk: Buffer) => {
                let offset = ID_SIZE
                const out: { [key: string]: any } = ID_SIZE
                    ? { id: chunk.readIntLE(0, ID_SIZE) }
                    : { id }
                for (let i = 0; i < this.columns?.length; i++) {
                    switch (this.columns[i][1]) {
                        case 'string':
                            out[this.columns[i][1]] = chunk.toString('utf8', offset, 8)
                            offset += this.columns[i][2]
                            break
                        case 'int':
                            out[this.columns[i][1]] = chunk.readIntLE(offset, 4)
                            offset += this.columns[i][2]
                            break

                        default:
                            break
                    }
                }

                resolve(out)
            })
            //below for larger sizes
            // str.on('data', (chunk) => chunks.push(Buffer.from(chunk))) //A & B
            // str.on('end', () => {
            //     const buff = Buffer.concat(chunks)
            //     console.log(buff, chunks.length)
            //     console.log(buff.toString('utf8', 0, 8), chunks.length)
            //     console.log(buff, buff.readIntLE(8, 4), chunks.length)
            //     resolve(chunks)
            // })
        })
    }
}

//cars
const schema: schema = [
    //id is auto
    ['model', 'string', 8],
    ['produced', 'int', 4], // or allow user to enter a max number and calc eg. 1_000_000 => 3 because 3 bye max over 1mil
    //  atoms:['int',6],
]

async function main() {
    const cars = new Table('samples/cars.db', 'cars', schema)
    const id = await cars.push(['foffo', 435])
    console.log('id', id)

    const id2 = await cars.push(['vvvolo', 1234556])
    await cars.push(['foggy', 12334556])
    await cars.push(['👵🏽', 35])
    await cars.push(['b', 43])
    await cars.push(['triumpth', 380])
    console.log('id2', id2)
    for (let i = 0; i < 600; i++) {
        let r = randomString()
        await cars.push([r, Math.floor(Math.random() * 1000000)])
    }
    console.timeEnd()
    console.time()
    const dat = await cars.read(22)
    console.log('dat', dat)

    console.timeLog()
}
main()

function randomString() {
    return Math.random().toString(36).slice(2, 7)
}
//console.log('cars', cars)
