import * as fs from 'fs'
import { basename, join, resolve } from 'path'
import * as os from 'os'
import { Table, schema } from '../src'
import { assert } from 'console'
import { resolveSoa } from 'dns'

const TEMP_DIR = resolve(__dirname, 'temp-' + basename(__filename).split('.')[0])

const FARMER_PATH = resolve(TEMP_DIR, 'farmers')
beforeAll(() => {
    if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true })
    fs.mkdirSync(TEMP_DIR)
    console.log(fs.statSync(TEMP_DIR))
})
afterAll(() => {
    try {
        console.log(fs.statSync(TEMP_DIR))
        fs.unlinkSync(TEMP_DIR)
        fs.rmSync(TEMP_DIR, { recursive: true })
    } catch (err) {
        console.error(err)
    }
})

const farmersSchema: schema = [
    ['name', 'string', 30],
    ['animal', 'string', 10],
    ['born', 'int', 2], // or allow user to enter a max number and calc eg. 1_000_000 => 3 because 3 bye max over 1mil
    //  atoms:['int',6],
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
// function performMany(path){
//     console.log(path)
// }
describe('stress suite', () => {
    //The user should never do this but it can
    it('might be able to do many operations', async () => {
        const SIZE = 4000
        const farmersA = new Table(FARMER_PATH)
        await farmersA.createTable('farmers', farmersSchema, { ifExists: 'read' })
        for (let i = 0; i < 1_000_00; i++) {
            await farmersA.push([
                rand(fnames) + ' ' + rand(fnames) + ' ' + rand(surnames),
                rand(animals),
                intB(1918, 2008),
            ])
        }

        const log = jest.spyOn(console, 'log').mockImplementation(() => {})
        const digits = [...Array(SIZE).keys()]
        const fObjects = digits.map((_, i) => new Table(FARMER_PATH))
        console.log('gg', fs.statSync(TEMP_DIR))

        await Promise.all(
            fObjects.map(farmer => {
                return farmer.getTable()
            })
        )
        const res = await Promise.all(
            fObjects.map(farmer => {
                return farmer.getRow(intB(1, 10))
            })
        )
        log.mockRestore()
        console.log(res.length)
        farmersA.rmTableSync()
        expect(res.length).toBe(SIZE)
    }, 15000)
})
