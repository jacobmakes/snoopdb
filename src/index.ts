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
type getRowReturn = Promise<{ id: number; [key: string]: string | number } | false>
interface queueItem {
    type: string
    data: Buffer
    symbol: symbol
}
interface tableConfig {
    ifExists?: 'overwrite' | 'read' | 'error'
}
type obj = { [key: string]: any }
export interface queryOptions {
    //columns?: string[]//deprecated before release
    filter?: (arg: obj) => boolean
    map?: (arg: obj) => any
    limit?: number
    offset?: number
}

export class Table extends EventEmitter {
    private initialized: boolean
    private name!: string
    private columns!: schema
    private config: any
    protected start!: number
    protected rowSize!: number
    private queue: queueItem[]
    private indexes: Indexes = {}
    private locked: boolean
    private writeStream!: fs.WriteStream
    private rows!: number

    constructor(readonly path: string) {
        super()
        this.initialized = false
        this.queue = []
        this.locked = false
    }
    private checkInit() {
        if (!this.initialized) {
            throw 'table not yet created. use createTable() or getTable()'
        }
    }

    public async createTable(name: string, columns: schema, config?: tableConfig) {
        if (fs.existsSync(this.path)) {
            if (config?.ifExists === 'read') {
                if (this.initialized) return
                await this.getTable()
                return
            } else if (config?.ifExists !== 'overwrite') {
                throw 'table already exists set config.ifExists to get or overwrite'
            }
        }
        return new Promise((resolve, reject) => {
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
                return reject('Table Schema undefined')
            }
            this.writeStream = fs.createWriteStream(this.path, { encoding: 'binary', flags: 'a' })
            this.writeStream.on('open', () => {
                const colNames: string[] = []
                columns.forEach(col => {
                    if (col[0] === 'id') return reject('cannot name column "id"')
                    colNames.push(col[0])
                    if (!colTypes.includes(col[1])) {
                        return reject(
                            `invalid type ${col[1]} acceptable types: ${colTypes.join('","')}`
                        )
                    }
                })
                if (colNames.length !== new Set(colNames).size)
                    return reject('column names must be unique')

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
                this.initialized = true
                return resolve(true)
            })
        })
    }
    public async getTable() {
        //check if table exists
        if (!fs.existsSync(this.path)) throw 'table does not exist'
        if (this.initialized) throw 'table already initialized'

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
                    fs.stat(this.path, (error, stat) => {
                        if (error) reject(error)
                        const { size } = stat
                        const rowCount = (size - this.start) / this.rowSize
                        if (!Number.isInteger(rowCount)) reject('non integer rowCount')
                        this.rows = rowCount
                        readMeta.close()
                        readSchema.close()
                        this.writeStream = fs.createWriteStream(this.path, {
                            encoding: 'binary',
                            flags: 'a',
                        })
                        this.writeStream.on('open', () => {
                            this.initialized = true
                            resolve(cols)
                        })
                    })
                })
            })
        })
    }
    public async getRowCount() {
        return ((await fs.promises.stat(this.path)).size - this.start) / this.rowSize
    }
    public getRowCountSync() {
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
        this.checkInit()
        return new Promise((resolve, reject) => {
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
    public async pushMany(rows: row[]): Promise<{ added: number; startId: number }> {
        this.checkInit()
        return new Promise((resolve, reject) => {
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
                        throw (
                            'row.length must match schema.length a row: `' +
                            row[i] +
                            '` > ' +
                            this.columns[i][2]
                        )
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

    public async getRow(id: number): getRowReturn {
        if (id < 1) throw "Id's start at 1!" // check impact of this on speed
        return new Promise((resolve, reject) => {
            const offset = (id - 1) * this.rowSize + this.start
            const str = fs.createReadStream(this.path, {
                start: offset,
                end: offset + this.rowSize - 1,
                highWaterMark: this.rowSize + 1,
            })
            console.log('id', id)

            str.on('data', (chunk: Buffer) => {
                str.close()
                let offset = 0
                console.log('point', id, chunk.toString('utf8', offset, offset + 10))
                const out: { id: number; [key: string]: string | number } = { id }
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
                            console.log('lol')
                            break
                    }
                }

                return resolve(out)
            })
            str.on('end', () => resolve(false))
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
        // if (options.map && options.columns)
        //     throw 'cannot use options map and columns together. pick one'
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

                    if (options.filter && options.filter(out) === false) continue
                    // if (options.columns) {
                    //     this.columns.forEach(col => {
                    //         if (!options.columns?.includes(col[0])) {
                    //             delete out[col[0]]
                    //         }
                    //     })
                    // }
                    if (options.map) {
                        out = options.map(out)
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
            out[key] = Object.keys(value)
        }
        return out
    }
    private async createHash(colName: string, fast = false): Promise<HashIndex | FastHashIndex> {
        return new Promise(async (resolve, reject) => {
            const hash: obj = {}
            await this.select({
                map: row => {
                    const key = row[colName]
                    if (!hash[key]) {
                        hash[key] = []
                    }
                    hash[key].push(fast ? row : row.id)
                },
            })
            this.indexes[colName] ??= {}
            this.indexes[colName][fast ? 'fastHash' : 'hash'] = hash
            resolve(hash)
        })
    }
    async hashIndex(colName: string) {
        return this.createHash(colName)
        //TODO accept an array to do multitple i.e forEach,
    }
    async hashIndexFast(colName: string) {
        return this.createHash(colName, true)
    }
    async hashFind<T extends string | number>(
        colName: string,
        lookup: T,
        options: { MAX_READS?: number } = {}
    ): Promise<any[]> {
        return new Promise(async (resolve, reject) => {
            if (!this?.indexes?.[colName]?.hash) {
                reject('no hash index')
                return
            }
            const hash = this.indexes[colName].hash
            //@ts-ignore
            const ids: number[] = hash[lookup + '']

            //faster but limit problem 158.363ms
            // const rows = await Promise.all(ids.map(async id => await this.read(id)))

            //slowest and safest 330.258ms, slower than select all
            // const rows = []
            // for await (let id of ids) {
            //     rows.push(await this.read(id))
            // }

            //good middle ground 157.227ms
            const MAX_CHUNK = options.MAX_READS || 1000
            var a = ids,
                chunk
            const split = []
            while (a.length > 0) {
                chunk = a.splice(0, MAX_CHUNK)
                split.push(chunk)
            }
            const rows = []
            for await (let chunk of split) {
                rows.push(await Promise.all(chunk.map(async id => await this.getRow(id))))
            }

            // console.log('rows', rows)
            return resolve(rows)
        })
    }
    async hashFindFast<T extends string | number>(colName: string, lookup: T): Promise<any[]> {
        return new Promise(async (resolve, reject) => {
            if (!this?.indexes?.[colName]?.fastHash) {
                reject('no fastHash index')
                return
            }
            //@ts-ignore
            const hash = this.indexes[colName].fastHash[lookup + '']
            resolve(hash)
        })
    }
    rmTableSync() {
        if (fs.existsSync(this.path)) {
            this.writeStream.destroy()
            fs.rmSync(this.path)
        }
    }
}

type indexTypes = 'hash' | 'tree' | 'fastHash'
interface Indexes {
    [columnName: string]: { [key in indexTypes]?: HashIndex | treeIndex | FastHashIndex }
}
interface HashIndex {
    [key: string]: number[]
}
interface FastHashIndex {
    [key: string]: any
}
interface treeIndex {
    [key: string]: number[]
}
//export default Table
