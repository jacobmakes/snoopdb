import * as fs from 'fs'
import { join, resolve } from 'path'
import * as os from 'os'
import { Table, schema } from '../src'
import { assert } from 'console'

const TEMP_DIR = resolve(__dirname, 'temp')
const CAR_PATH = resolve(TEMP_DIR, 'where.db')
const TRAIN_PATH = resolve(TEMP_DIR, 'train.db')

beforeAll(() => {
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR)
    if (fs.existsSync(CAR_PATH)) fs.rmSync(CAR_PATH)
})
afterAll(() => {
    console.log('removing', TEMP_DIR)
    //doesn't delete directory does delete contents
    fs.rmSync(TEMP_DIR, { recursive: true })
})
const schema1: schema = [
    //id is auto
    ['model', 'string', 8],
    ['produced', 'int', 4], // or allow user to enter a max number and calc eg. 1_000_000 => 3 because 3 bye max over 1mil
    //  atoms:['int',6],
]
describe('main suite', () => {
    it('Must have unique column names', async () => {
        const trains = new Table(TRAIN_PATH)
        expect(() =>
            trains.createTable(
                'noobs',
                [
                    ['wheels', 'ints', 4],
                    ['wheeels', 'string', 8],
                ],
                { overwrite: false }
            )
        ).toThrowError()
    })
    it('Test Creating table', async () => {
        const cars = new Table(CAR_PATH)
        cars.createTable('cars', schema1, { overwrite: false })
        const row1 = await cars.push(['foffo', 435])
        expect(row1).toEqual({ id: 1, model: 'foffo', produced: 435 })

        await cars.push(['foggy', 12334556])
        await cars.push(['👵🏽', 35])
        const row4 = await cars.push(['vvvolo', 1234556])
        expect(row4).toEqual({ id: 4, model: 'vvvolo', produced: 1234556 })
        await cars.push(['b', 43])
        await cars.push(['triumpth', 380])

        const readRow4 = await cars.read(4)
        expect(readRow4).toEqual({ id: 4, model: 'vvvolo', produced: 1234556 })
    })
})
