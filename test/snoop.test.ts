import * as fs from 'fs'
import { join, resolve } from 'path'
import * as os from 'os'
import { Table, schema } from '../src'
import { assert } from 'console'
import { resolveSoa } from 'dns'

const TEMP_DIR = resolve(__dirname, 'temp')
const CAR_PATH = resolve(TEMP_DIR, 'where.db')
const TRAIN_PATH = resolve(TEMP_DIR, 'train.db')

function makeRandomTable() {
    const str = Math.random().toString(36).slice(2, 9)

    return new Table(resolve(TEMP_DIR, str))
}

beforeAll(() => {
    if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true })
    fs.mkdirSync(TEMP_DIR)
})
// afterAll(() => {
//     console.log('removing', TEMP_DIR)
//     //doesn't delete directory does delete contents
//     fs.rmSync(TEMP_DIR, { recursive: true })
// })
const schema1: schema = [
    //id is auto
    ['model', 'string', 10],
    ['produced', 'int', 4], // or allow user to enter a max number and calc eg. 1_000_000 => 3 because 3 bye max over 1mil
    //  atoms:['int',6],
]
it("create table deson't create file", () => {
    const trains = new Table(TRAIN_PATH)
    expect(fs.existsSync(TRAIN_PATH)).toBe(false)
    trains.rmTableSync()
})
describe('main suite', () => {
    let trains: Table
    it('copy', async () => {})
    beforeEach(() => {
        trains = new Table(TRAIN_PATH)
    })
    afterEach(() => {
        trains.rmTableSync()
    })

    it('Must have unique column names', async () => {
        await expect(
            trains.createTable(
                'noobs',
                [
                    // ['id', 'ints', 4],
                    ['wheels', 'int', 4],
                    ['wheels', 'string', 8],
                ],
                { ifExists: 'error' }
            )
        ).rejects.toBe('column names must be unique')
    })
    it('cannot have id column', async () => {
        await expect(
            trains.createTable(
                'noobs',
                [
                    ['id', 'int', 4],
                    ['wheels', 'string', 8],
                ],
                { ifExists: 'error' }
            )
        ).rejects.toBe('cannot name column "id"')
    })
    it("reading a table that doesn't exist fails", async () => {
        await expect(trains.getTable()).rejects.toBe('table does not exist')
    })
    it('creating a table that exists fails if configured', async () => {
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        await expect(trains.createTable('trains', schema1, { ifExists: 'error' })).rejects.toBe(
            'table already exists set config.ifExists to get or overwrite'
        )
    })
    it('Pushing into created table fails', async () => {
        await expect(trains.push(['foggy', 12334556])).rejects.toContain('table not yet created')
    })

    //these two tests show how confusing testing thrown errors is
    it('getRowCount count on no table fails', async () => {
        await expect(trains.getRowCount()).rejects.toThrowError()
    })
    it('getRowCountSync count on no table fails', () => {
        expect(() => trains.getRowCountSync()).toThrowError()
    })

    it('creating a table that exists succeds if read configured', async () => {
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        trains.push(['Dora', 94])
        await trains.createTable('trains', schema1, { ifExists: 'read' })
        expect(await trains.getRow(1)).toEqual({ id: 1, model: 'Dora', produced: 94 })
    })
    it('Can read table from file', async () => {
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        trains.push(['Lorax', 94])
        const trains2 = new Table(TRAIN_PATH)
        await trains2.getTable()
        await expect(trains.getRow(1)).resolves.toEqual({ id: 1, model: 'Lorax', produced: 94 })
        await expect(trains2.getRow(1)).resolves.toEqual({ id: 1, model: 'Lorax', produced: 94 })
    })
    it('copy', async () => {})
    it('copy', async () => {})
    it('copy', async () => {})
    it('copy', async () => {})
    it('copy', async () => {})

    it('Can push and read data correctly', async () => {
        //const trains = new Table(CAR_PATH)
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        const row1 = await trains.push(['foffo', 435])
        expect(row1).toEqual({ id: 1, model: 'foffo', produced: 435 })
        await trains.push(['foggy', 12334556])
        await trains.push(['👵🏽', 35])
        const row4 = await trains.push(['vvvolo', 1234556])
        expect(row4).toEqual({ id: 4, model: 'vvvolo', produced: 1234556 })
        await trains.push(['b', 43])
        await trains.push(['triumpth', 380])
        const readRow4 = await trains.getRow(4)
        expect(readRow4).toEqual({ id: 4, model: 'vvvolo', produced: 1234556 })
    })
    it('Can push many rows', async () => {
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        const row1 = await trains.push(['foffo', 435])
        expect(row1).toEqual({ id: 1, model: 'foffo', produced: 435 })
        await trains.push(['foggy', 12334556])
        await trains.push(['👵🏽', 35])
        const manyRows = [
            ['going', 435],
            ['loco', 4325],
            ['down', 678],
            ['in', 786],
            ['', 786],
            ['alcupolco', 786],
        ]
        const outcome = await trains.pushMany(manyRows)
        expect(outcome).toEqual({ added: 6, startId: 4 })
        const rowAfter = await trains.push(['vvvolo', 1234556])
        const readRow5 = await trains.getRow(5)
        expect(readRow5).toEqual({ id: 5, model: 'loco', produced: 4325 })
        const pos = outcome.startId + outcome.added
        console.log(await trains.select())
        expect(rowAfter).toEqual({
            id: pos,
            model: 'vvvolo',
            produced: 1234556,
        })
        const readRow7 = await trains.getRow(11)
        console.log('readRow7', readRow7)
    })
})
