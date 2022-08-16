import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { Buffer } from 'buffer'
import { stringify } from 'querystring'
import { EventEmitter, Readable } from 'stream'
import { resolve } from 'path'
import { CreateReadStreamOptions } from 'fs/promises'
import { ReadStreamOptions } from '../types'

console.time()

type rP = Parameters<typeof fs.createReadStream>
function readBinary(path: rP[0], options?: rP[1]) {
    const str = fs.createReadStream(path, options)
    // const str= fs.createReadStream('myBinaryFile'); //B
    let chunks = ''
    str.on('data', chunk => (chunks += chunk.toString('utf-8'))) //A & B
    str.on('end', () => console.log('ll', chunks, chunks.length)) //A 5.609ms
}

const cutNull = (string: string) => {
    let i = 0
    while (i < string.length) {
        if (string[i] === '\x00') return string.substring(0, i)
        i++
    }
    return string
}

function calculateRowSize(schema: schema) {
    let bytes = 0
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

export type schema = column[]
type row = (string | number)[]
interface queueItem {
    type: string
    data: Buffer
    symbol: symbol
}
interface tableConfig {
    overwrite?: boolean
}
type obj = { [key: string]: any }
interface queryOptions {
    columns?: string[]
    where?: (arg: obj) => boolean
    transform?: (arg: obj) => any
    limit?: number
    offset?: number
}

export class Table extends EventEmitter {
    private name!: string
    private columns!: schema
    private config: any
    protected start!: number
    protected rowSize!: number
    private queue: queueItem[]
    private indexes: Indexes = {}
    private locked: boolean
    private writeStream
    private rows!: number

    constructor(readonly path: string) {
        super()
        this.queue = []
        this.locked = false
        this.writeStream = fs.createWriteStream(this.path, { encoding: 'binary', flags: 'a' })
    }
    public createTable(name: string, columns: schema, config?: tableConfig) {
        if (fs.existsSync(this.path) && config?.overwrite !== true)
            throw 'table already exists set config.overwrite to true to overwrite'
        this.name = name
        this.columns = columns
        this.config = config
        this.indexes = {}
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
        const colNames: string[] = []
        columns.forEach(col => {
            colNames.push(col[0])
            if (!colTypes.includes(col[1])) {
                throw `invalid type ${col[1]} acceptable types: ${colTypes.join('","')}`
            }
        })
        if (colNames.length != new Set(colNames).size) throw 'column names must be unique'

        const schemaLength = Buffer.from(JSON.stringify(columns)).length
        const START = schemaLength + 12 // + add options hedaers to size
        const VERSION = 1
        const SCHEMA_END = schemaLength + 12
        const headers = Buffer.alloc(START)
        headers.writeInt32LE(START)
        headers.writeInt32LE(VERSION, 4)
        headers.writeInt32LE(SCHEMA_END, 8)
        headers.write(JSON.stringify(columns), 12)
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
        console.log(headers)
        //@ts-ignore
        this.rowSize = calculateRowSize(this.columns)
        this.rows = 0
        console.log('created table')
    }
    public async getTable() {
        //check if table exists
        if (!fs.existsSync(this.path)) throw 'table does not exist'

        return new Promise((resolve, reject) => {
            console.log('this.path', this.path)
            const readMeta = fs.createReadStream(this.path, { end: 12 })
            readMeta.on('data', (chunk: Buffer) => {
                this.start = chunk.readInt32LE()
                const schemaEnd = chunk.readInt32LE(8)
                console.log('schemaEnd', schemaEnd)

                const readSchema = fs.createReadStream(this.path, {
                    start: 12,
                    end: schemaEnd - 1,
                    highWaterMark: schemaEnd, //uneessacary?
                })
                //not calling on end because high water mark so low
                readSchema.on('data', (chunk: Buffer) => {
                    console.log('cols', chunk.toString())
                    const cols = JSON.parse(chunk.toString())
                    this.columns = cols
                    this.rowSize = calculateRowSize(this.columns)
                    const { size } = fs.statSync(this.path)
                    const rowCount = (size - this.start) / this.rowSize
                    if (!Number.isInteger(rowCount)) throw 'non integer rowCount'
                    this.rows = rowCount
                    resolve(cols)
                })
            })
        })
    }
    public async getRowCount() {
        return new Promise(async res =>
            res(((await fs.promises.stat(this.path)).size - this.start) / this.rowSize)
        )
    }
    public async getRowCountSync() {
        return (fs.statSync(this.path).size - this.start) / this.rowSize
    }
    private add(item: queueItem) {
        this.locked ? this.queue.push(item) : this.process(item)
    }
    private process(newItem?: queueItem) {
        this.locked = true

        if (newItem) this.queue.push(newItem)
        if (this.queue.length == 0) return
        const item = this.queue.shift()!
        switch (item.type) {
            case 'addRow':
                this.addRow(item)
                break
            case 'addMany':
                this.addMany(item)
                break
            default:
                break
        }
        this.locked = false
        this.process()
        this.locked = false
    }
    private addRow({ data: buff, symbol }: queueItem) {
        const rowCount = this.rows++
        this.writeStream.write(buff, () => this.emit(symbol, rowCount + 1))
    }
    private addMany({ data: buff, symbol }: queueItem) {
        const initRowCount = this.rows
        const rowAddCount = buff?.length / this.rowSize
        this.rows += rowAddCount
        this.writeStream.write(buff, () =>
            this.emit(symbol, { startId: initRowCount + 1, added: rowAddCount })
        )
    }
    public async push(row: row) {
        //check size matches
        return new Promise(async (resolve, reject) => {
            const rowBuffer = this.makeRowBuffer(row)
            const symbol = Symbol()
            this.once(symbol, id => {
                // console.log('listening', id)
                // console.timeLog()
                const out: obj = { id }
                for (let i = 0; i < row.length; i++) {
                    out[this.columns[i][0]] = row[i]
                }
                resolve(out)
            })
            this.add({
                type: 'addRow',
                data: rowBuffer,
                symbol,
            })
        })
    }
    public async pushMany(rows: row[]) {
        //check size matches
        return new Promise(async (resolve, reject) => {
            const rowsBuffer: Buffer[] = []
            for (const row of rows) {
                rowsBuffer.push(this.makeRowBuffer(row))
            }
            const symbol = Symbol()
            this.once(symbol, result => {
                resolve(result)
            })
            this.add({
                type: 'addMany',
                data: Buffer.concat(rowsBuffer),
                symbol,
            })
        })
    }
    private makeRowBuffer(row: row) {
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
        const padding = this.rowSize - newRow.length
        //final redundant check
        if (padding < 0) {
            throw 'row too large'
        }
        return Buffer.concat([newRow, Buffer.alloc(padding)])
    }
    public async read(id: number) {
        return new Promise(async (resolve, reject) => {
            const offset = (id - 1) * this.rowSize + this.start
            const str = fs.createReadStream(this.path, {
                start: offset,
                end: offset + this.rowSize - 1,
                highWaterMark: this.rowSize + 1,
            })
            str.on('data', (chunk: Buffer) => {
                let offset = 0
                const out: obj = { id }
                const cols = this.columns
                for (let i = 0; i < cols?.length; i++) {
                    switch (cols[i][1]) {
                        case 'string':
                            out[cols[i][0]] = cutNull(
                                chunk.toString('utf8', offset, offset + cols[i][2])
                            )
                            offset += cols[i][2]
                            break
                        case 'int':
                            out[cols[i][0]] = chunk.readIntLE(offset, cols[i][2])
                            offset += cols[i][2]
                            break

                        default:
                            break
                    }
                }

                resolve(out)
            })
            //below for larger sizes
            // let chunks = []
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

    public async select(options: queryOptions = {}) {
        if (options.transform && options.columns)
            throw 'cannot use options transform and columns together. pick one'
        return new Promise(async (resolve, reject) => {
            let resultCount = 0
            const rowsPerChunk = 10000 // Biggest effect on speed
            const skip = options.offset ? options.offset : 0
            const streamConfig: ReadStreamOptions = {
                start: this.start + skip * this.rowSize,
                highWaterMark: this.rowSize * rowsPerChunk,
            }
            // if (options.limit) {
            //     streamConfig.end = options.limit * this.rowSize
            // }
            const str = fs.createReadStream(this.path, streamConfig)
            const search = (str: string) => str.includes('gg')
            let results: any[] = []
            let chunkIndex = -1
            str.on('data', (chunk: Buffer) => {
                const chunkRows = Math.floor(chunk.length / this.rowSize)
                chunkIndex++
                for (let i = 0; i < chunkRows; i++) {
                    const rowOffset = i * this.rowSize
                    let colOffset = 0
                    const cols = this.columns
                    let out: obj = {
                        id: chunkIndex * rowsPerChunk + i + 1 + skip,
                    }

                    for (let i = 0; i < cols.length; i++) {
                        switch (cols[i][1]) {
                            case 'string':
                                const str = cutNull(
                                    chunk.toString(
                                        'utf-8',
                                        colOffset + rowOffset,
                                        colOffset + rowOffset + cols[i][2]
                                    )
                                )
                                out[cols[i][0]] = str
                                colOffset += cols[i][2]
                                break
                            case 'int':
                                out[cols[i][0]] = chunk.readIntLE(colOffset + rowOffset, cols[i][2])
                                colOffset += cols[i][2]
                                break

                            default:
                                break
                        }
                    }

                    if (options.where && options.where(out) === false) continue
                    if (options.columns) {
                        this.columns.forEach(col => {
                            if (!options.columns?.includes(col[0])) {
                                delete out[col[0]]
                            }
                        })
                    }
                    if (options.transform) {
                        out = options.transform(out)
                    }
                    results.push(out)

                    resultCount++
                    if (options.limit && resultCount >= options.limit) {
                        str.close()
                        resolve(results)
                        break
                    }
                }
                //process.exit()
            }) //A & B
            str.on('end', () => {
                // console.log(buff, chunks.length)
                // console.log(buff.toString('utf8', 0, 8), chunks.length)
                // console.log(buff, buff.readIntLE(8, 4), chunks.length)
                resolve(results)
            })
        })
    }
    indexList() {
        const out: obj = {}
        for (const [key, value] of Object.entries(this.indexes)) {
            console.log(`${key}: ${value}`)
            out[key] = Object.keys(value)
        }
        return out
    }
    private async createHash(colName: string, fast = false): Promise<HashIndex | FastHashIndex> {
        return new Promise(async (resolve, reject) => {
            const hash: obj = {}
            await this.select({
                transform: row => {
                    const key = row[colName]
                    if (!hash[key]) {
                        hash[key] = []
                    }
                    hash[key].push(fast ? row : row.id)
                },
            })
            resolve(hash)
        })
    }
    async hashIndex(colName: string) {
        return new Promise(async (resolve, reject) => {
            const freshHash = await this.createHash(colName)
            this.indexes[colName] ??= {}
            this.indexes[colName]['hash'] = freshHash
            console.log('this.indexes', this.indexes)
            console.log('this.indexes', this.indexes)

            // if (!this.indexes?.[colName]?.['hash']) {
            //     this.indexes[colName]['hash'] = []
            // }
            resolve(true)
        })
    }
    async hashFind<T extends string | number>(colName: string, lookup: T) {
        return new Promise(async (resolve, reject) => {
            const hash = this.indexes[colName].hash
            const ids: number[] = hash[lookup + '']
            const rows = await Promise.all(ids.map(async id => await this.read(id)))
            console.log('rows', rows)
        })
    }
}

type indexTypes = 'hash' | 'tree' | 'fastHash'
interface Indexes {
    [columnName: string]: { [key in indexTypes]?: HashIndex | treeIndex }
}
interface HashIndex {
    [key: string]: number[]
}
interface FastHashIndex {
    [key: string]: any
}
interface treeIndex {}
//export default Table
