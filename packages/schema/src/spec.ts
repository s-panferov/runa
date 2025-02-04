import { cmd, Command } from "./cmd";
import { BuildContext, Output, Query } from "./index";
import { Schema, SchemaMode, TO_SCHEMA } from "./schema";
import { SpecT } from "./target";

export interface BuildSpecArgs<T extends SpecT> {
  key?: string[];
  inp: T["In"];
  out: T["Out"];
  inout?: T["InOut"];
  ready?: T["Ready"];
}

export class BuildSpec<T extends SpecT> {
  #key: string[];
  #in: T["In"];
  #out: T["Out"];
  #inout: T["InOut"];
  #ready?: T["Ready"];
  #command?: Command;
  #runtime?: string;

  constructor(args: BuildSpecArgs<T>) {
    this.#in = args.inp;
    this.#out = args.out;
    this.#inout = args.inout || {};
    this.#ready = args.ready;
    this.#key = args.key || [];
  }

  runtime<T extends { default: { SPEC: T } }>(path: string): this {
    this.#runtime = path;
    return this;
  }

  in<const I extends SpecT["In"]>(
    inp: I
  ): BuildSpec<{
    In: T["In"] & I;
    Out: T["Out"];
    InOut: T["InOut"];
    Ready: T["Ready"];
  }> {
    this.#in = { ...this.#in, inp };
    return this as any;
  }

  out<const O extends SpecT["Out"]>(
    out: O
  ): BuildSpec<{
    In: T["In"];
    Out: T["Out"] & O;
    InOut: T["InOut"];
    Ready: T["Ready"];
  }> {
    this.#out = { ...this.#out, ...out };
    return this as any;
  }

  inout<const IO extends SpecT["InOut"]>(
    inout: IO
  ): BuildSpec<{
    In: T["In"];
    Out: T["Out"];
    InOut: T["InOut"] & IO;
    Ready: T["Ready"];
  }> {
    this.#inout = { ...this.#inout, ...inout };
    return this as any;
  }

  command(
    func: (
      ctx: typeof cmd & {
        $: typeof cmd;
        inp: Query<T["In"]>;
        out: Query<T["Out"]>;
      },
      inp: Query<T["In"]>,
      out: Query<T["Out"]>
    ) => Command
  ): this {
    function $(...args: any[]) {
      return cmd.apply(null, args as any);
    }

    $.$ = cmd;
    $.inp = Output.dyn<Query<T["In"]>>(undefined, "inp");
    $.out = Output.dyn<Query<T["Out"]>>(undefined, "out");
    $.sh = cmd.sh;

    this.#command = func($, $.inp, $.out);
    return this;
  }

  [TO_SCHEMA](schema: Schema) {
    const object = {
      key: this.#key,
      inp: {} as Record<string, any>,
      out: {} as Record<string, any>,
      inout: {} as Record<string, any>,
      ready: {} as Record<string, any>,
      command: undefined as object | undefined,
      runtime: this.#runtime,
    };

    if (!this.#runtime) {
      delete object.runtime;
    }

    const before = schema.mode;

    schema.withMode(SchemaMode.Input);
    for (const [k, v] of Object.entries(this.#in)) {
      if (!v) continue;
      object.inp[k] = schema.convert(v);
    }

    schema.withMode(SchemaMode.Output);

    for (const [k, v] of Object.entries(this.#out)) {
      if (!v) continue;
      object.out[k] = schema.convert(v);
    }

    for (const [k, v] of Object.entries(this.#inout)) {
      if (!v) continue;
      object.inout[k] = schema.convert(v);
    }

    if (this.#ready) {
      for (const [k, v] of Object.entries(this.#ready)) {
        if (!v) continue;
        object.ready[k] = schema.convert(v);
      }
    }

    if (this.#command) {
      object.command = schema.convert(this.#command);
    } else {
      delete object.command;
    }

    schema.withMode(before);

    return object;
  }
}

export type BuildSpecFactory<T extends SpecT> = (
  ctx: BuildContext
) => BuildSpec<T>;
