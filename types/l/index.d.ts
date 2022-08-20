/// <reference types="node" />
import { EventEmitter } from 'stream';
declare type column = [string, string, number];
export declare type schema = column[];
declare type row = (string | number)[];
declare type getRowReturn = Promise<{
    id: number;
    [key: string]: string | number;
} | false>;
interface tableConfig {
    ifExists?: 'overwrite' | 'read' | 'error';
}
declare type obj = {
    [key: string]: any;
};
export interface queryOptions {
    filter?: (arg: obj) => boolean;
    map?: (arg: obj) => any;
    limit?: number;
    offset?: number;
}
export declare class Table extends EventEmitter {
    readonly path: string;
    private initialized;
    private name;
    private columns;
    private config;
    protected start: number;
    protected rowSize: number;
    private queue;
    private indexes;
    private locked;
    private writeStream;
    private rows;
    constructor(path: string);
    private checkInit;
    createTable(name: string, columns: schema, config?: tableConfig): Promise<unknown>;
    getTable(): Promise<unknown>;
    getRowCount(): Promise<number>;
    getRowCountSync(): number;
    private add;
    private process;
    private addRow;
    private addMany;
    push<T extends Array<any>>(row: [...T]): Promise<unknown>;
    pushMany(rows: row[]): Promise<{
        added: number;
        startId: number;
    }>;
    private makeRowBuffer;
    getRow(id: number): getRowReturn;
    select(options?: queryOptions): Promise<unknown>;
    indexList(): obj;
    private createHash;
    hashIndex(colName: string): Promise<HashIndex | FastHashIndex>;
    hashIndexFast(colName: string): Promise<HashIndex | FastHashIndex>;
    hashFind(colName: string, lookup: string | number, options?: {
        MAX_READS?: number;
    }): Promise<any[]>;
    hashFindFast<T extends string | number>(colName: string, lookup: T): Promise<any[]>;
    rmTableSync(): void;
}
interface HashIndex {
    [key: string]: number[];
}
interface FastHashIndex {
    [key: string]: any;
}
export {};
//# sourceMappingURL=index.d.ts.map