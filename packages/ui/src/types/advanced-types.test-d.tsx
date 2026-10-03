/**
 * Type-level tests (run by `vitest` typecheck mode, and compiled by `tsc` in
 * `pnpm typecheck`). Every `@ts-expect-error` below must be an actual error; an
 * unused directive fails the compile, so the negative cases cannot silently rot.
 */
import * as React from 'react';
import { describe, expectTypeOf, it } from 'vitest';

import { Alert } from '@/components/ui/alert';
import { CardTitle } from '@/components/ui/card';
import { Box } from '@/components/primitives/box';
import { Stack } from '@/components/primitives/stack';
import { Text } from '@/components/primitives/text';
import {
  addLength,
  percent,
  px,
  pxToRem,
  rem,
  remToPx,
  type AbsoluteLength,
  type Percent,
  type Px,
  type Rem
} from '@/lib/units';
import type { PolymorphicProps, PolymorphicRef } from '@/lib/polymorphic';

describe('branded CSS units', () => {
  it('constructors return branded lengths', () => {
    expectTypeOf(px(4)).toEqualTypeOf<Px>();
    expectTypeOf(rem(1)).toEqualTypeOf<Rem>();
    expectTypeOf(percent(50)).toEqualTypeOf<Percent>();
    expectTypeOf(pxToRem(px(16))).toEqualTypeOf<Rem>();
    expectTypeOf(remToPx(rem(1))).toEqualTypeOf<Px>();
  });

  it('plain strings and numbers are not lengths', () => {
    // @ts-expect-error a bare string literal is not a Px
    const a: Px = '12px';
    // @ts-expect-error a number is not a Px
    const b: Px = 12;
    // @ts-expect-error units do not mix: Rem is not Px
    const c: Px = rem(1);
    // @ts-expect-error units do not mix: Percent is not Rem
    const d: Rem = percent(10);
    void [a, b, c, d];
  });

  it('addLength only accepts the same unit', () => {
    expectTypeOf(addLength(px(1), px(2))).toEqualTypeOf<Px>();
    // @ts-expect-error px + rem must be converted first
    addLength(px(1), rem(1));
  });

  it('spacing excludes percentages', () => {
    expectTypeOf<Px>().toMatchTypeOf<AbsoluteLength>();
    expectTypeOf<Rem>().toMatchTypeOf<AbsoluteLength>();
    expectTypeOf<Percent>().not.toMatchTypeOf<AbsoluteLength>();
  });
});

describe('layout primitives take branded lengths', () => {
  it('Box props', () => {
    void (<Box padding={4} margin={px(8)} width={percent(100)} maxWidth={rem(40)} />);
    // @ts-expect-error percentages are not valid spacing
    void (<Box padding={percent(10)} />);
    // @ts-expect-error raw strings are rejected
    void (<Box width="100%" />);
    // @ts-expect-error off-scale spacing token
    void (<Box padding={7} />);
  });
});

describe('polymorphic `as`', () => {
  it('takes the props of the target element', () => {
    void (<Box as="a" href="/x" target="_blank" />);
    void (<Box as="button" type="submit" disabled />);
    void (<Box as="label" htmlFor="x" />);
    // @ts-expect-error div has no href
    void (<Box as="div" href="/x" />);
    // @ts-expect-error `disabled` is a button prop, not an anchor prop
    void (<Box as="a" href="/x" disabled />);
    // @ts-expect-error unknown element props are rejected
    void (<Box notAProp />);
  });

  it('types the ref for the target element', () => {
    expectTypeOf<PolymorphicRef<'a'>>().toEqualTypeOf<React.ComponentPropsWithRef<'a'>['ref']>();
    const anchorRef = React.createRef<HTMLAnchorElement>();
    void (<Box as="a" ref={anchorRef} href="/x" />);
    const divRef = React.createRef<HTMLDivElement>();
    // @ts-expect-error an anchor ref cannot be attached to a div
    void (<Box ref={anchorRef} />);
    void (<Box ref={divRef} />);
  });

  it('defaults to the component default element', () => {
    expectTypeOf<PolymorphicProps<'div'>>().toHaveProperty('as');
    void (<Text>hello</Text>);
    void (<Text as="p">hello</Text>);
    void (<Text as="time" dateTime="2026-01-01">hello</Text>);
    // @ts-expect-error `dateTime` belongs to <time>, not the default <span>
    void (<Text dateTime="2026-01-01">hello</Text>);
  });

  it('CardTitle is polymorphic with an h2 default', () => {
    void (<CardTitle>Title</CardTitle>);
    void (<CardTitle as="h3">Title</CardTitle>);
    void (<CardTitle as="div" role="heading" aria-level={3}>Title</CardTitle>);
  });
});

describe('discriminated variant props', () => {
  it('Stack: wrap exists only on a row', () => {
    void (<Stack direction="row" wrap gap={2} align="baseline" />);
    void (<Stack gap={px(12)} align="stretch" />);
    // @ts-expect-error `wrap` is meaningless on a column
    void (<Stack wrap />);
    // @ts-expect-error `wrap` is meaningless on an explicit column
    void (<Stack direction="column" wrap />);
    // @ts-expect-error baseline alignment is only offered on rows
    void (<Stack align="baseline" />);
  });

  it('Text: `lines` requires `truncate`', () => {
    void (<Text truncate lines={2}>x</Text>);
    void (<Text truncate>x</Text>);
    // @ts-expect-error lines without truncate
    void (<Text lines={2}>x</Text>);
    // @ts-expect-error lines must be 1..4
    void (<Text truncate lines={9}>x</Text>);
  });

  it('Alert: a dismissible alert must supply onDismiss', () => {
    void (<Alert tone="warn" title="Careful" />);
    void (<Alert tone="critical" dismissible onDismiss={() => undefined} />);
    // @ts-expect-error dismissible without a handler
    void (<Alert dismissible />);
    // @ts-expect-error a handler on a non-dismissible alert is dead code
    void (<Alert onDismiss={() => undefined} />);
    // @ts-expect-error unknown tone
    void (<Alert tone="success" />);
  });
});
