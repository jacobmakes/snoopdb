import * as fs from 'fs'
import { join, resolve } from 'path'
import * as os from 'os'
import { Table, schema } from '../src'
import { assert } from 'console'
import { resolveSoa } from 'dns'

const TEMP_DIR = resolve(__dirname, 'temp')
const CAR_PATH = resolve(TEMP_DIR, 'where.db')
const TRAIN_PATH = resolve(TEMP_DIR, 'long','path','train.db')

function makeRandomTable() {
    const str = Math.random().toString(36).slice(2, 9)

    return new Table(resolve(TEMP_DIR, str))
}

beforeAll(() => {
    if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true })
    fs.mkdirSync(TEMP_DIR,{recursive:true})
})
afterAll(() => {
    console.log('removing', TEMP_DIR)
    //doesn't delete directory does delete contents
    fs.rmSync(TEMP_DIR, { recursive: true })
})
const schema1: schema = [
    //id is auto
    ['model', 'string', 10],
    ['produced', 'int', 4], // or allow user to enter a max number and calc eg. 1_000_000 => 3 because 3 bye max over 1mil
    //  atoms:['int',6],
]
it("New table doesn't create file", () => {
    const trains = new Table(TRAIN_PATH)
    expect(fs.existsSync(TRAIN_PATH)).toBe(false)
    trains.rmTableSync()
})
describe('main suite', () => {
    // let trains: Table
    // it('copy', async () => {})
    // beforeEach(() => {
    //     trains = new Table(TRAIN_PATH)
    // })
    // afterEach(() => {
    //     trains.rmTableSync()
    // })

    it('Must have unique column names', async () => {
        const trains = makeRandomTable()
        await expect(
            trains.createTable(
                'noobs',
                [
                    ['wheels', 'int', 4],
                    ['wheels', 'string', 8],
                ],
                { ifExists: 'error' }
            )
        ).rejects.toThrow('column names must be unique')
    })
    it('cannot have id column', async () => {
        const trains = makeRandomTable()
        await expect(
            trains.createTable(
                'noobs',
                [
                    ['id', 'int', 4],
                    ['wheels', 'string', 8],
                ],
                { ifExists: 'error' }
            )
        ).rejects.toThrow('cannot name column "id"')
    })
    it('column size must be between 1 and 6', async () => {
        const s1: schema = [
            ['model', 'string', 10],
            ['produced', 'int', 7],
        ]
        const s2: schema = [
            ['model', 'string', 10],
            ['produced', 'int', 7],
        ]
        const trains = makeRandomTable()
        await expect(trains.createTable('trains', s1, { ifExists: 'error' })).rejects.toThrow(
            'column size must be between'
        )
        const trains2 = makeRandomTable()
        await expect(trains2.createTable('trains', s2, { ifExists: 'error' })).rejects.toThrow(
            'column size must be between'
        )
    })
    it("reading a table that doesn't exist fails", async () => {
        const trains = makeRandomTable()
        await expect(trains.getTable()).rejects.toThrow('table does not exist')
    })
    it('creating a table that exists fails if configured', async () => {
        const trains = makeRandomTable()
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        await expect(trains.createTable('trains', schema1, { ifExists: 'error' })).rejects.toThrow(
            'table already exists set config.ifExists to get or overwrite'
        )
    })
    it('Pushing into created table fails', async () => {
        const trains = makeRandomTable()
        await expect(trains.push(['foggy', 12334556])).rejects.toThrow('table not yet created')
    })

    //these two tests show how confusing testing thrown errors is
    it('getRowCount count on no table fails', async () => {
        const trains = makeRandomTable()
        await expect(trains.getRowCount()).rejects.toThrowError()
    })
    it('getRowCountSync count on no table fails', () => {
        const trains = makeRandomTable()
        expect(() => trains.getRowCountSync()).toThrowError()
    })

    it('creating a table that exists succeds if read configured', async () => {
        const trains = makeRandomTable()
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        trains.push(['Dora', 94])
        await trains.createTable('trains', schema1, { ifExists: 'read' })
        expect(await trains.getRow(1)).toEqual({ id: 1, model: 'Dora', produced: 94 })
    })
    it('Can read table from file', async () => {
        const trains = makeRandomTable()
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        trains.push(['Lorax', 94])
        const trains2 = new Table(trains.path)
        await trains2.getTable()
        await expect(trains.getRow(1)).resolves.toEqual({ id: 1, model: 'Lorax', produced: 94 })
        await expect(trains2.getRow(1)).resolves.toEqual({ id: 1, model: 'Lorax', produced: 94 })
    })
    it('reading rows that', async () => {})
    it('copy', async () => {})
})

describe('Adding Data', () => {
    it('Can push and read data correctly', async () => {
        const trains = makeRandomTable()
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
        const readRowAgain = await trains.getRow(4)
        expect(readRowAgain).toEqual({ id: 4, model: 'vvvolo', produced: 1234556 })
    })
    it('Can push many rows', async () => {
        const trains = makeRandomTable()
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
        expect(rowAfter).toEqual({
            id: pos,
            model: 'vvvolo',
            produced: 1234556,
        })
    })
    it('reading bad id returns false', async () => {
        const trains = makeRandomTable()
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        expect(trains.getRow(0)).rejects.toThrow("Id's start at 1!")
        expect(trains.getRow(-5646)).rejects.toThrow("Id's start at 1!")
        expect(await trains.getRow(1035)).toEqual(false)
        expect(await trains.getRow(102314324312435)).toEqual(false)
        await trains.push(['cleaveland', 435])
        let r = await trains.getRow(1)
        expect(r).toEqual({ id: 1, model: 'cleaveland', produced: 435 })
    })
    it('Id expected after push many and read', async () => {
        const trains = makeRandomTable()
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
        let rowAfter = await trains.push(['vvvolo', 1234556])
        let readRow5 = await trains.getRow(5)
        expect(readRow5).toEqual({ id: 5, model: 'loco', produced: 4325 })
        const pos = outcome.startId + outcome.added
        expect(trains.getRowCountSync()).toEqual(pos)
        //@ts-ignore
        expect(trains.rows).toEqual(pos)
        expect(rowAfter).toEqual({
            id: pos,
            model: 'vvvolo',
            produced: 1234556,
        })
        const trains2 = new Table(trains.path)
        await trains2.getTable()
        rowAfter = await trains.push(['foool', 4444])
        readRow5 = await trains.getRow(5)
        expect(readRow5).toEqual({ id: 5, model: 'loco', produced: 4325 })
        expect(rowAfter).toEqual({
            id: 11,
            model: 'foool',
            produced: 4444,
        })
        const outcome2 = await trains2.pushMany(manyRows)
        expect(outcome2).toEqual({ added: 6, startId: 11 })
    })
    it('updates correctly', async () => {
        const trains = makeRandomTable()
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        const manyRows = [
            ['going', 435],
            ['loco', 4325],
            ['down', 678],
            ['in', 786],
            ['', 786],
            ['alcupolco', 786],
        ]
        await trains.pushMany(manyRows)
        const updated = await trains.update(2, ['lavidaloca', 777])
        expect(updated).toEqual({
            id: 2,
            model: 'lavidaloca',
            produced: 777,
        })
        let res
        for (let i = 0; i < 2000; i++) {
            res = await trains.update(2, ['in a gadda', intB(2, 9090)])
        }

        const read = await trains.getRow(2)
        expect(res).toEqual(read)
        await expect(trains.update(66, ['lavidaloca', 777])).rejects.toThrow('row with that id')
        await expect(trains.update(6, ['the rivers of babylon', 777])).rejects.toThrow(
            'length must match schema'
        )
    })
    it('Pushing string too large fails', async () => {
        const trains = makeRandomTable()
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        expect(trains.push(['There once was an ugly duckling', 435])).rejects.toThrow(
            'row.length must match schema.length a row'
        )
        expect(
            trains.pushMany([
                ['quack', 435],
                ['There once was an ugly duckling', 435],
            ])
        ).rejects.toThrow('row.length must match schema.length a row')
    })

    it('Pushing int too large fails int 1', async () => {
        const s1: schema = [
            ['model', 'string', 10],
            ['produced', 'int', 1],
        ]
        const trains = makeRandomTable()
        await trains.createTable('trains', s1, { ifExists: 'error' })
        await trains.push(['duck', -128])
        await expect(trains.push(['duck', 128])).rejects.toThrow('out of range')
        await expect(trains.push(['duck', -455])).rejects.toThrow('out of range')
    })
    it('Pushing int too large fails int 4', async () => {
        const s1: schema = [
            ['model', 'string', 10],
            ['produced', 'int', 4],
        ]
        const trains = makeRandomTable()
        await trains.createTable('trains', s1, { ifExists: 'error' })
        await trains.push(['duck', 256 ** 4 / 2 - 2])
        await expect(trains.push(['duck', 256 ** 4])).rejects.toThrow('out of range')
        await expect(trains.push(['duck', 256 ** 5])).rejects.toThrow('out of range')
        await expect(trains.push(['duck', 4523534542354325])).rejects.toThrow('out of range')
        await expect(trains.push(['duck', 4523534544354354352354325435])).rejects.toThrow(
            'out of range'
        )
    })
    it('reading bad id returns false', async () => {
        const trains = makeRandomTable()
        await trains.createTable('trains', schema1, { ifExists: 'error' })
        const row1 = await trains.push(['cleaveland', 435])
    })
})

const farmersSchema: schema = [
    ['name', 'string', 30],
    ['animal', 'string', 10],
    ['born', 'int', 2],
]

const fnames = [
    'Emily',
    'Aaron',
    'Charles',
    'Rebecca',
    'Jacob',
    'Stephen',
    'Patrick',
    'Sean',
    'Erin',
    'Zachary',
    'Jamie',
    'Kelly',
    'Samantha',
]
const surnames = ['Rogers', 'Beckett', 'Juniper', 'Daily', 'Bruno']

const animals = ['sheep', 'cow', 'pig', 'chicken']

const rand = (arr: any[]) => {
    return arr[Math.floor(Math.random() * arr.length)]
}

function intB(min: number, max: number) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min)
}

const FARMER_PATH = resolve(TEMP_DIR, 'farmers')

describe('Selecting data', () => {
    let farmers: Table
    const SIZE = 40000
    const EXTRA = 200
    async function makeFarmers() {
        farmers = new Table(FARMER_PATH)
        await farmers.createTable('farmers', farmersSchema, { ifExists: 'overwrite' })
        for (let i = 0; i < SIZE; i++) {
            await farmers.push([
                rand(fnames) + ' ' + rand(fnames) + ' ' + rand(surnames),
                rand(animals),
                intB(1918, 2008),
            ])
        }
        await farmers.push(['Danny', 'sheep', 2009])
        const arr: (string | number)[][] = []
        for (let i = 0; i < EXTRA; i++) {
            arr.push([
                rand(fnames) + ' ' + rand(fnames) + ' ' + rand(surnames),
                'unicorn',
                intB(1918, 2008),
            ])
        }
        await farmers.pushMany(arr)
    }
    beforeAll(async () => {
        await makeFarmers()
    })
    it('selects the right number of columns', async () => {
        const all = await farmers.select()
        expect(all.length).toEqual(SIZE + EXTRA + 1)
    })
    it('rowCount works', async () => {
        const count = await farmers.getRowCount()
        expect(count).toEqual(SIZE + EXTRA + 1)
    })
    it('rowCountSync works', () => {
        const count = farmers.getRowCountSync()
        expect(count).toEqual(SIZE + EXTRA + 1)
    })
    it('limit and startId works', async () => {
        const firstTenSheep = await farmers.select({
            filter: row => row.animal === 'sheep',
            limit: 10,
        })

        expect(firstTenSheep.length).toEqual(10)
        const SixToTenSheep = await farmers.select({
            filter: row => row.animal === 'sheep',
            limit: 5,
            startId: firstTenSheep[5].id,
        })
        expect(SixToTenSheep.length).toEqual(5)
        expect(firstTenSheep.slice(5, 11)).toEqual(SixToTenSheep)
    })
    //in no way a pure function
    async function animalCount(animal: string) {
        let res = await farmers.select({ limit: 100, filter: row => row.animal === animal })
        const all = res
        while (res.length > 0) {
            res = await farmers.select({
                limit: 100,
                startId: res[res.length - 1].id + 1,
                filter: row => row.animal === animal,
            })
            all.push(...res)
        }
        return all.length
    }
    it('startId works to paginate', async () => {
        let count = 0
        const animals = ['sheep', 'cow', 'pig', 'chicken', 'unicorn']
        for (let animal of animals) {
            count += await animalCount(animal)
        }
        expect(count).toEqual(SIZE + EXTRA + 1)
    })
    it('filter works', async () => {
        const unicornOwners = await farmers.select({
            filter: row => row.animal === 'unicorn',
        })
        expect(unicornOwners.length).toEqual(EXTRA)
    })
    it('map works', async () => {
        const danny = await farmers.select({
            filter: row => row.name === 'Danny',
            map: row => `Oh, ${row.name} boy, the pipes, the pipes are calling`,
        })
        expect(danny.length).toEqual(1)
        expect(danny[0]).toEqual('Oh, Danny boy, the pipes, the pipes are calling')
    })
    describe('Index testing', () => {
        it('hash index works', async () => {
            await farmers.hashIndex('name')
            await expect(farmers.hashIndex('age')).rejects.toThrow('does not exist')

            let danny = await farmers.hashFind('name', 'Danny')
            expect(danny.length).toEqual(1)
            expect(danny[0].born).toEqual(2009)
            //twice because it was orignally modifying the hash
            danny = await farmers.hashFind('name', 'Danny')
            expect(danny.length).toEqual(1)
            expect(danny[0].born).toEqual(2009)
            await farmers.hashIndex('born')
            danny = await farmers.hashFind('born', 2009)
            expect(danny[0].name).toEqual('Danny')
            await expect(farmers.hashFind('animal', 19)).rejects.toThrow('no hash index for')
        })
        it('Fast hash index works', async () => {
            await farmers.hashIndexFast('name')
            await expect(farmers.hashIndexFast('age')).rejects.toThrow('column age does not exist')

            let danny = await farmers.hashFindFast('name', 'Danny')
            expect(danny.length).toEqual(1)
            expect(danny[0].born).toEqual(2009)
            //twice because it was orignally modifying the hash
            danny = await farmers.hashFindFast('name', 'Danny')
            expect(danny.length).toEqual(1)
            expect(danny[0].born).toEqual(2009)
            await farmers.hashIndexFast('born')
            danny = await farmers.hashFindFast('born', 2009)
            expect(danny[0].name).toEqual('Danny')
            await expect(farmers.hashFindFast('animal', 19)).rejects.toThrow(
                'no fastHash index for'
            )
        })
        it('hash index works to update', async () => {
            await makeFarmers()
            await farmers.hashIndex('name')
            await farmers.hashIndex('animal')
            const danny = await farmers.hashFind('name', 'Danny')
            const pigFarmersA = await farmers.hashFind('animal', 'pig')
            expect(danny.length).toEqual(1)
            expect(danny[0].born).toEqual(2009)
            await farmers.push(['Danny', 'pig', 2008])
            expect(danny.length).toEqual(1) //because index not updated
            await farmers.hashIndex('animal')
            await farmers.hashIndex('name')
            const danny2 = await farmers.hashFind('name', 'Danny')
            const pigFarmersB = await farmers.hashFind('animal', 'pig')
            expect(danny2.length).toEqual(2) //because index not updated
            expect(pigFarmersA.length + 1).toEqual(pigFarmersB.length)
        })
        it('hash index Fast works to update', async () => {
            await makeFarmers()
            await farmers.hashIndexFast('name')
            await farmers.hashIndexFast('animal')
            const danny = await farmers.hashFindFast('name', 'Danny')
            const pigFarmersA = await farmers.hashFindFast('animal', 'pig')
            expect(danny.length).toEqual(1)
            expect(danny[0].born).toEqual(2009)
            await farmers.push(['Danny', 'pig', 2008])
            expect(danny.length).toEqual(1) //because index not updated
            await farmers.hashIndexFast('animal')
            await farmers.hashIndexFast('name')
            const danny2 = await farmers.hashFindFast('name', 'Danny')
            const pigFarmersB = await farmers.hashFindFast('animal', 'pig')
            expect(danny2.length).toEqual(2) //because index not updated
            expect(pigFarmersA.length + 1).toEqual(pigFarmersB.length)
        })
    })
})
