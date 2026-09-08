export class SparseSet {
    _dense: number[] = [];
    _sparse: number[] = [];
    _cursor: number = 0;
    _retained: number = 0;
    _denseRaw: { array: number[]; length: number } = { array: this._dense, length: 0 };

    has(val: number): boolean {
        const index = this._sparse[val];
        return index < this._cursor && this._dense[index] === val;
    }

    add(val: number): void {
        // 所属判定と新規key判定で同じ索引値を使い、初回Query構築の二重読取りを避ける。
        const index = this._sparse[val];
        if (index < this._cursor && this._dense[index] === val) return;

        // FORK(Query/sparse-retention): 削除ごとのdeleteは通常の除去を遅くするため、
        // 新しいkeyの蓄積が生存数の2倍（小集合では1024）を超えたときだけ再構築する。
        // 同じkeyの再利用では整理せず、世代を含む番号の履歴が無制限に残ることを防ぐ。
        if (index === undefined) {
            this._retained++;
            if (this._retained > 1024 && this._retained > this._cursor * 2) {
                this._sparse = [];
                for (let i = 0; i < this._cursor; i++) this._sparse[this._dense[i]] = i;
                this._retained = this._cursor + 1;
            }
        }

        this._sparse[val] = this._cursor;
        this._dense[this._cursor++] = val;
    }

    remove(val: number): void {
        if (!this.has(val)) return;
        const index = this._sparse[val];
        this._cursor--;
        const swapped = this._dense[this._cursor];
        if (swapped !== val) {
            this._dense[index] = swapped;
            this._sparse[swapped] = index;
        }
    }

    clear(): void {
        // FORK(Query/sparse-retention): clear後は過去のkeyも所有しない。
        this._sparse = [];
        this._retained = 0;
        this._cursor = 0;
    }

    sort(): void {
        // FORK(Query/sparse-retention): 除去済みtailをsortへ戻さず、現在集合の索引を作る。
        this._dense.length = this._cursor;
        this._sparse = [];
        this._retained = this._cursor;
        this._dense.sort((a, b) => a - b);
        for (let i = 0; i < this._dense.length; i++) {
            this._sparse[this._dense[i]] = i;
        }
    }

    getIndex(val: number): number {
        return this._sparse[val];
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

    get sparse(): number[] {
        return this._sparse;
    }
}
