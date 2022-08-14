import * as fs from 'fs'
import * as path from 'path'
import * as stream from 'stream'
import * as os from 'os'
import { Buffer } from 'buffer'
import { stringify } from 'querystring'

type rP = Parameters<typeof fs.createReadStream>
function readBinary(path: rP[0], options?: rP[1]) {
    const str = fs.createReadStream(path, options)
    // const str= fs.createReadStream('myBinaryFile'); //B
    let chunks = ''
    str.on('data', (chunk) => (chunks += chunk.toString('utf-8'))) //A & B
    str.on('end', () => console.log('ll', chunks, chunks.length)) //A 5.609ms
}
function calculateRowSize(schema: schema) {
    let bytes = 4 //for ID
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
const rowCount = (headerSize: number, rowSize: number, fileSize: number) => {
    const rows = (fileSize - headerSize) / rowSize
    if (!Number.isInteger(rows)) throw 'non integer row'
    return rows
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
}

class DbFile {
    private queue: queueItem[]
    private locked: boolean
    constructor(private path: string) {
        this.queue = []
        this.locked = false
    }
    public async write(buff: Buffer) {
        this.add({ type: 'addRow', data: buff })
    }
    private async add(item: queueItem) {
        this.locked ? this.queue.push(item) : this.process(item)
    }
    private async process(newItem?: queueItem) {
        this.locked = true
        //console.log('que', this.queue, newItem)

        if (newItem) this.queue.push(newItem)
        //console.log('que2', this.queue)
        if (this.queue.length == 0) return
        const item = this.queue.shift()
        switch (item.type) {
            case 'addRow':
                await this.addRow(item.data!)
                break

            default:
                break
        }
        this.locked = false
        await this.process()
    }
    private async addRow(buff: Buffer) {
        const { size } = await fs.promises.stat(this.path)
        await fs.promises.appendFile(this.path, buff, { encoding: 'binary' })

        console.log('size', size, this.path)
    }
}
class Table {
    protected start: number
    protected rowSize: number
    private dbfile: DbFile

    constructor(
        readonly path: string,
        readonly name: string,
        private columns?: schema,
        private config?: any
    ) {
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

        this.dbfile = new DbFile(this.path)
        const schemaLength = Buffer.from(JSON.stringify(schema)).length
        console.log(schemaLength)
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
    }

    public async push(row: row) {
        //check size matches

        if (row.length !== this.columns?.length) {
            throw 'row.length must match schema.length'
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
                    buff = Buffer.allocUnsafe(this.columns[i][2])
                    //@ts-ignore
                    buff.writeIntLE(row[i], 0, this.columns[i][2])
                    break
                default:
                    console.log(this.columns[i][1])
                    throw 'no type match found'
            }
            buffers.push(buff)
        }
        const newRow = Buffer.concat(buffers)
        const padding = this.rowSize - newRow.length - 4 //4 for id
        //final reduntant check
        if (padding < 0) {
            throw 'row too large'
        }
        this.dbfile.write(Buffer.concat([newRow, Buffer.alloc(padding)]))

        // fs.stat(this.path, (error, stat) => {
        //     console.log('dd', stat.size)

        //     const wstream = fs.createWriteStream(this.path, { encoding: 'binary', flags: 'a' })

        //     wstream.write(Buffer.concat([newRow, Buffer.alloc(padding)]), (err) => {
        //         return
        //     })
        //     wstream.end()
        // })
    }
}

//cars
const schema: schema = [
    //id is auto
    ['model', 'string', 10],
    ['produced', 'int', 4], // or allow user to enter a max number and calc eg. 1_000_000 => 3 because 3 bye max over 1mil
    //  atoms:['int',6],
]

const cars = new Table('samples/cars.db', 'cars', schema)
cars.push(['foffffo', 435])
cars.push(['vvvolo', 123456789])
//console.log('cars', cars)
