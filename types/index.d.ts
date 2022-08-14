export {}

interface StreamOptions {
    flags?: string | undefined
    encoding?: BufferEncoding | undefined
    fd?: number | promises.FileHandle | undefined
    mode?: number | undefined
    autoClose?: boolean | undefined
    /**
     * @default false
     */
    emitClose?: boolean | undefined
    start?: number | undefined
    highWaterMark?: number | undefined
}
export interface ReadStreamOptions extends StreamOptions {
    end?: number | undefined
}
//# sourceMappingURL=index.d.ts.map
