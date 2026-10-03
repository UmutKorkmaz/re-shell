import * as React from 'react';

/**
 * Polymorphic component typing.
 *
 * A polymorphic component takes an `as` prop naming the element (or component)
 * it renders, and its remaining props are exactly the props of THAT target:
 * `<Box as="a" href="/x" />` type-checks, `<Box as="div" href="/x" />` does not,
 * and the forwarded `ref` is typed for the target element.
 */

/** The `as` prop. */
export type AsProp<C extends React.ElementType> = { as?: C };

/** Keys the component's own props (plus `as`) own, removed from the target's props. */
type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

/**
 * Own props `Props` + `as` + the target element's props (minus anything `Props`
 * or `as` already defines, and without `ref`).
 */
export type PolymorphicProps<C extends React.ElementType, Props = object> = Props &
  AsProp<C> &
  Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, Props>>;

/** The ref type of the target element. */
export type PolymorphicRef<C extends React.ElementType> = React.ComponentPropsWithRef<C>['ref'];

/** {@link PolymorphicProps} plus the typed `ref`. */
export type PolymorphicPropsWithRef<C extends React.ElementType, Props = object> = PolymorphicProps<C, Props> & {
  ref?: PolymorphicRef<C>;
};

/**
 * The call signature of a polymorphic component whose default element is
 * `Default`. Assign a `React.forwardRef` result to this via a cast.
 */
export type PolymorphicComponent<Default extends React.ElementType, Props = object> = {
  <C extends React.ElementType = Default>(props: PolymorphicPropsWithRef<C, Props>): React.ReactElement | null;
  displayName?: string;
};

/**
 * Create a polymorphic, ref-forwarding component. `render` is written against
 * the widest element type; the returned component is typed per call site by
 * {@link PolymorphicComponent} (the one cast lives here, not in every component).
 */
export function forwardPolymorphic<Default extends React.ElementType, Props = object>(
  render: (
    props: PolymorphicProps<React.ElementType, Props>,
    ref: React.ForwardedRef<unknown>
  ) => React.ReactElement | null,
  displayName: string
): PolymorphicComponent<Default, Props> {
  const component = React.forwardRef(render as unknown as React.ForwardRefRenderFunction<unknown, object>);
  component.displayName = displayName;
  return component as unknown as PolymorphicComponent<Default, Props>;
}
