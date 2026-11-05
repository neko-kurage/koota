import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function functions(directory) {
    const code = readdirSync(directory)
        .filter((name) => name.startsWith('chunk-') && name.endsWith('.js'))
        .map((name) => readFileSync(resolve(directory, name), 'utf8'))
        .join('\n');
    const tree = ts.createSourceFile(
        'bundle.js',
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS
    );
    return new Map(
        tree.statements
            .filter(ts.isFunctionDeclaration)
            .map((node) => [node.name.text, node.getText(tree)])
    );
}
const [baselinePath, candidatePath] = process.argv.slice(2);
const baseline = functions(baselinePath);
const candidate = functions(candidatePath);
const names = ['createEntity', 'addTrait', 'removeTrait', 'destroyEntity', 'setTrait'];
const result = Object.fromEntries(
    names.map((name) => [
        name,
        baseline.has(name) && candidate.has(name) && baseline.get(name) === candidate.get(name),
    ])
);
console.log(JSON.stringify(result, null, 2));
if (Object.values(result).some((equal) => !equal)) process.exitCode = 1;
