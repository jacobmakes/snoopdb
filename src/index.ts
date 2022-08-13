import * as fs from 'fs'
import * as path from 'path'
import * as stream from 'stream'
import * as os from 'os'
import { Buffer } from 'buffer'

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

//array format [type,max value,]
//console.log(os.endianness())
const colTypes = ['string', 'int']

type column = [string, string, number]

type schema = column[]

class Table {
    protected start: number
    protected rowSize: number

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
        const wstream = fs.createWriteStream(this.path, { encoding: 'binary' })
        wstream.write(headers, () =>
            readBinary(this.path, {
                start: 12,
                end: SCHEMA_END - 1,
            })
        )
        wstream.end()
        this.start = START
        //@ts-ignore
        this.rowSize = calculateRowSize(this.columns)
        console.log(headers)
    }

    protected getRowCount() {
        const { size } = fs.statSync(this.path)
        console.log('s', size - this.start)
        return (size - this.start) / this.rowSize
    }

    public push<T extends number | string>(row: T[]) {
        //check size matches
        return new Promise((resolve, reject) => {
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
                        buff = Buffer.from(row[i])
                        if (buff.length > this.columns[i][2]) {
                            throw 'row.length must match schema.length'
                        }
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
            const lastId = this.getRowCount()
            console.log('lastId', lastId)

            const newRow = Buffer.concat(buffers)
            const padding = this.rowSize - newRow.length
            //final reduntant check
            if (padding < 0) {
                throw 'row too large'
            }

            const wstream = fs.createWriteStream(this.path, { encoding: 'binary', flags: 'a' })

            wstream.write(Buffer.concat([newRow, Buffer.alloc(padding)]), (err) => {
                resolve()
            })
        })
    }
}

//cars
const schema: schema = [
    //id is auto
    ['model', 'string', 10],
    ['produced', 'int', 4], // or allow user to enter a max number and calc eg. 1_000_000 => 3 because 3 bye max over 1mil
    //  atoms:['int',6],
]
;(async () => {
    const cars = new Table('cars.db', 'cars', schema)
    await cars.push(['fofffford', 435])
    cars.push(['vvvolvoo', 123456789])
    console.log('cars', cars)
})()
