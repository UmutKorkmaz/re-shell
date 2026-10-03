#!/usr/bin/env python3
"""Escape `|` inside inline code spans of GitHub-flavored-markdown table rows.

A pipe inside a code span still ends a table cell unless it is written `\\|`, so a
cell such as `workspace policy check|install` silently splits into two columns.
This rewrites such pipes in place and then verifies that every row of every table
has the same number of cells as its header.

    python3 scripts/fix-md-table-pipes.py [--check] FILE_OR_DIR...

With --check nothing is written; the exit status is 1 if a file needs changes or a
table is malformed.
"""
import pathlib
import re
import sys

SPAN = re.compile(r'(`+)(.+?)\1')


def escape_spans(row: str) -> str:
    def repl(m):
        body = re.sub(r'(?<!\\)\|', r'\\|', m.group(2))
        return m.group(1) + body + m.group(1)

    return SPAN.sub(repl, row)


def cells(row: str) -> int:
    body = row.strip()
    if body.startswith('|'):
        body = body[1:]
    if body.endswith('|') and not body.endswith('\\|'):
        body = body[:-1]
    return len(re.split(r'(?<!\\)\|', body))


def process(path: pathlib.Path, write: bool):
    text = path.read_text()
    lines = text.split('\n')
    out = []
    problems = []
    in_fence = False
    i = 0
    changed = False
    while i < len(lines):
        line = lines[i]
        if re.match(r'^\s*(```|~~~)', line):
            in_fence = not in_fence
        is_row = (not in_fence) and line.lstrip().startswith('|')
        if not is_row:
            out.append(line)
            i += 1
            continue
        block = []
        while i < len(lines) and lines[i].lstrip().startswith('|'):
            block.append(lines[i])
            i += 1
        fixed = [escape_spans(r) for r in block]
        if fixed != block:
            changed = True
        out.extend(fixed)
        if len(fixed) >= 2 and re.match(r'^\s*\|?\s*:?-{3,}', fixed[1]):
            width = cells(fixed[0])
            for n, r in enumerate(fixed):
                if cells(r) != width:
                    problems.append(f'{path}: table row {n + 1} has {cells(r)} cells, header has {width}: {r[:80]}')
    if changed and write:
        path.write_text('\n'.join(out))
    return changed, problems


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    write = '--check' not in sys.argv
    files = []
    for a in args:
        p = pathlib.Path(a)
        files += [p] if p.is_file() else sorted(p.rglob('*.md'))
    bad = False
    for f in files:
        if 'node_modules' in f.parts or f.parts[-1] == 'CLI-CONTRACTS.md':
            continue
        changed, problems = process(f, write)
        if changed:
            print(('would fix ' if not write else 'fixed ') + str(f))
            bad = bad or not write
        for p in problems:
            print('MALFORMED ' + p)
            bad = True
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
