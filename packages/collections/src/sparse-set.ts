/** removeAllで外す位置の印。全集合で共有し、使い終えたら0へ戻す。 */
let removalMarks = new Uint8Array(0);

export class SparseSet {
    _dense: number[] = [];
    _sparse: Map<number, number[]> = new Map();
    _cursor: number = 0;
    _retained: number = 0;
    _denseRaw: { array: number[]; length: number } = { array: this._dense, length: 0 };

    has(val: number): boolean {
        const segment = Math.floor(val / 1024);
        const page = this._sparse.get(segment);
        const index = page?.[val - segment * 1024]!;
        return index < this._cursor && this._dense[index] === val;
    }

    add(val: number): void {
        const segment = Math.floor(val / 1024);
        const offset = val - segment * 1024;
        let page = this._sparse.get(segment);
        const index = page?.[offset]!;
        if (index < this._cursor && this._dense[index] === val) return;

        // 新規keyの履歴が1024件と生存数の2倍をともに超えたら、索引を再構築する。
        if (index === undefined) {
            this._retained++;
            if (this._retained > 1024 && this._retained > this._cursor * 2) {
                this._sparse = new Map();
                for (let i = 0; i < this._cursor; i++) this.setIndex(this._dense[i], i);
                this._retained = this._cursor + 1;
                page = this._sparse.get(segment);
            }
        }

        // 再構築後だけ新しいMapからページを取り直し、それ以外は先に取得したページを使う。
        if (page === undefined) {
            page = new Array<number>(1024);
            this._sparse.set(segment, page);
        }
        page[offset] = this._cursor;
        this._dense[this._cursor++] = val;
    }

    /** 値を順に追加する。連続する値が同じページなら、ページの検索を共有する。 */
    addAll(values: readonly number[]): void {
        let segment = -1;
        let page: number[] | undefined;
        for (let i = 0; i < values.length; i++) {
            const val = values[i];
            const valueSegment = Math.floor(val / 1024);
            if (valueSegment !== segment) {
                segment = valueSegment;
                page = this._sparse.get(segment);
            }
            const offset = val - segment * 1024;
            const index = page?.[offset]!;
            if (index < this._cursor && this._dense[index] === val) continue;

            if (index === undefined) {
                this._retained++;
                if (this._retained > 1024 && this._retained > this._cursor * 2) {
                    this._sparse = new Map();
                    for (let j = 0; j < this._cursor; j++) this.setIndex(this._dense[j], j);
                    this._retained = this._cursor + 1;
                    page = this._sparse.get(segment);
                }
            }

            if (page === undefined) {
                page = new Array<number>(1024);
                this._sparse.set(segment, page);
            }
            page[offset] = this._cursor;
            this._dense[this._cursor++] = val;
        }
    }

    // FORK(Entity/batch-destroy): 一括削除が、削除待ちのqueueを経ずにQueryの並びからまとめて外す。
    /** 同じ順で連続して並ぶ値の区間を、末尾の値で埋めて外す。連続していなければ何もせずfalseを返す。 */
    removeRun(values: readonly number[]): boolean {
        const count = values.length;
        if (count === 0) return true;
        const start = this.getIndex(values[0]);
        if (!(start < this._cursor) || start + count > this._cursor) return false;
        const dense = this._dense;
        for (let offset = 0; offset < count; offset++) {
            if (dense[start + offset] !== values[offset]) return false;
        }

        // 区間の後ろに残る値のうち、末尾から区間の長さまでを、順を保って区間へ移す。
        const after = this._cursor - start - count;
        const moved = after < count ? after : count;
        for (let offset = 0; offset < moved; offset++) {
            const value = dense[this._cursor - moved + offset];
            dense[start + offset] = value;
            this.setIndex(value, start + offset);
        }
        this._cursor -= count;
        return true;
    }

    /**
     * 値をまとめて外し、含まれない値は飛ばす。連続した区間ならremoveRunで外す。
     * それ以外は外す位置に印を付け、末尾に残る値で前の穴を埋める。
     */
    removeAll(values: readonly number[]): void {
        if (this.removeRun(values)) return;
        const length = this._cursor;
        if (removalMarks.length < length)
            removalMarks = new Uint8Array(Math.max(length, removalMarks.length * 2));
        const marks = removalMarks;
        const dense = this._dense;
        let removed = 0;
        for (let index = 0; index < values.length; index++) {
            const position = this.getIndex(values[index]);
            if (!(position < length) || dense[position] !== values[index] || marks[position] === 1)
                continue;
            marks[position] = 1;
            removed++;
        }
        if (removed === 0) return;

        const kept = length - removed;
        let tail = length - 1;
        for (let index = 0; index < kept; index++) {
            if (marks[index] === 0) continue;
            marks[index] = 0;
            while (marks[tail] === 1) tail--;
            const value = dense[tail--];
            dense[index] = value;
            this.setIndex(value, index);
        }
        marks.fill(0, kept, length);
        this._cursor = kept;
    }

    remove(val: number): void {
        const segment = Math.floor(val / 1024);
        const page = this._sparse.get(segment);
        const index = page?.[val - segment * 1024]!;
        if (!(index < this._cursor) || this._dense[index] !== val) return;
        this._cursor--;
        const swapped = this._dense[this._cursor];
        if (swapped !== val) {
            this._dense[index] = swapped;
            this.setIndex(swapped, index);
        }
    }

    clear(): void {
        // FORK(Query/sparse-retention): clear後は過去のkeyも所有しない。
        this._sparse = new Map();
        this._retained = 0;
        this._cursor = 0;
    }

    sort(): void {
        // FORK(Query/sparse-retention): 除去済みtailをsortへ戻さず、現在集合の索引を作る。
        this._dense.length = this._cursor;
        this._sparse = new Map();
        this._retained = this._cursor;
        this._dense.sort((a, b) => a - b);
        for (let i = 0; i < this._dense.length; i++) {
            this.setIndex(this._dense[i], i);
        }
    }

    getIndex(val: number): number {
        const segment = Math.floor(val / 1024);
        const page = this._sparse.get(segment);
        return page?.[val - segment * 1024]!;
    }

    get dense(): number[] {
        return this._dense.slice(0, this._cursor);
    }

    get denseRaw(): { array: number[]; length: number } {
        this._denseRaw.length = this._cursor;
        return this._denseRaw;
    }

    get rawDense(): readonly number[] {
        return this._dense;
    }

    get length(): number {
        return this._cursor;
    }

    private setIndex(value: number, index: number): void {
        const segment = Math.floor(value / 1024);
        let page = this._sparse.get(segment);
        if (page === undefined) {
            page = new Array<number>(1024);
            this._sparse.set(segment, page);
        }

        const offset = value - segment * 1024;
        page[offset] = index;
    }

    get sparse(): number[] {
        const result: number[] = [];
        for (const [segment, page] of this._sparse) {
            for (const offset of Object.keys(page)) {
                const pageOffset = Number(offset);
                const sparseIndex = segment * 1024 + pageOffset;
                result[sparseIndex] = page[pageOffset];
            }
        }

        return result;
    }
}
