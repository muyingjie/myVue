const PublicPatchFlags = {
    TEXT: 1 /* TEXT */,
    CLASS: 2 /* CLASS */,
    STYLE: 4 /* STYLE */,
    PROPS: 8 /* PROPS */,
    FULL_PROPS: 16 /* FULL_PROPS */,
    NEED_PATCH: 32 /* NEED_PATCH */,
    KEYED_FRAGMENT: 64 /* KEYED_FRAGMENT */,
    UNKEYED_FRAGMENT: 128 /* UNKEYED_FRAGMENT */,
    DYNAMIC_SLOTS: 256 /* DYNAMIC_SLOTS */,
    BAIL: -1 /* BAIL */
};

const globalsWhitelist = new Set(('Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,' +
    'decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,' +
    'Object,Boolean,String,RegExp,Map,Set,JSON,Intl').split(','));

const EMPTY_OBJ =  Object.freeze({});
const EMPTY_ARR = [];
const NOOP = () => { };
const isOn = (key) => key[0] === 'o' && key[1] === 'n';
const extend = (a, b) => {
    for (const key in b) {
        a[key] = b[key];
    }
    return a;
};
const hasOwnProperty = Object.prototype.hasOwnProperty;
const hasOwn = (val, key) => hasOwnProperty.call(val, key);
const isArray = Array.isArray;
const isFunction = (val) => typeof val === 'function';
const isString = (val) => typeof val === 'string';
const isObject = (val) => val !== null && typeof val === 'object';
const objectToString = Object.prototype.toString;
const toTypeString = (value) => objectToString.call(value);
const isPlainObject = (val) => toTypeString(val) === '[object Object]';
const vnodeHooksRE = /^vnode/;
const isReservedProp = (key) => key === 'key' || key === 'ref' || vnodeHooksRE.test(key);
const camelizeRE = /-(\w)/g;
const camelize = (str) => {
    return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''));
};
const hyphenateRE = /\B([A-Z])/g;
const hyphenate = (str) => {
    return str.replace(hyphenateRE, '-$1').toLowerCase();
};
const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

function createComponent(options) {
    return isFunction(options) ? { setup: options } : options;
}

let LOCKED = true;
function lock() {
    LOCKED = true;
}
function unlock() {
    LOCKED = false;
}

const builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol)
    .map(key => Symbol[key])
    .filter(value => typeof value === 'symbol'));

function createGetter(isReadonly) {
    return function get(target, key, receiver) {
        const res = Reflect.get(target, key, receiver);
        if (typeof key === 'symbol' && builtInSymbols.has(key)) {
            return res;
        }
        if (isRef(res)) {
            return res.value;
        }
        track(target, "get" /* GET */, key);
        return isObject(res)
            ? isReadonly
                ? // need to lazy access readonly and reactive here to avoid circular dependency
                readonly(res)
                : reactive(res)
            : res;
    };
}

function set(target, key, value, receiver) {
    value = toRaw(value);
    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    if (isRef(oldValue) && !isRef(value)) {
        oldValue.value = value;
        return true;
    }
    const result = Reflect.set(target, key, value, receiver);
    // don't trigger if target is something up in the prototype chain of original
    if (target === toRaw(receiver)) {
        const extraInfo = { oldValue, newValue: value };
        if (!hadKey) {
            trigger(target, "add" /* ADD */, key, extraInfo);
        } else if (value !== oldValue) {
            trigger(target, "set" /* SET */, key, extraInfo);
        }
    }
    return result;
}

function deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    const result = Reflect.deleteProperty(target, key);
    if (hadKey) {
        trigger(target, "delete" /* DELETE */, key, { oldValue });
    }
    return result;
}

function has(target, key) {
    const result = Reflect.has(target, key);
    track(target, "has" /* HAS */, key);
    return result;
}

function ownKeys(target) {
    track(target, "iterate" /* ITERATE */);
    return Reflect.ownKeys(target);
}

const mutableHandlers = {
    get: createGetter(false),
    set,
    deleteProperty,
    has,
    ownKeys
};

const readonlyHandlers = {
    get: createGetter(true),
    set(target, key, value, receiver) {
        if (LOCKED) {
            console.warn(`Set operation on key "${key}" failed: target is readonly.`, target);
            return true;
        } else {
            return set(target, key, value, receiver);
        }
    },
    deleteProperty(target, key) {
        if (LOCKED) {
            console.warn(`Delete operation on key "${key}" failed: target is readonly.`, target);
            return true;
        } else {
            return deleteProperty(target, key);
        }
    },
    has,
    ownKeys
};

const toReactive = (value) => (isObject(value) ? reactive(value) : value);
const toReadonly = (value) => (isObject(value) ? readonly(value) : value);

function get(target, key, wrap) {
    target = toRaw(target);
    key = toRaw(key);
    const proto = Reflect.getPrototypeOf(target);
    track(target, "get" /* GET */, key);
    const res = proto.get.call(target, key);
    return wrap(res);
}
function has$1(key) {
    const target = toRaw(this);
    key = toRaw(key);
    const proto = Reflect.getPrototypeOf(target);
    track(target, "has" /* HAS */, key);
    return proto.has.call(target, key);
}
function size(target) {
    target = toRaw(target);
    const proto = Reflect.getPrototypeOf(target);
    track(target, "iterate" /* ITERATE */);
    return Reflect.get(proto, 'size', target);
}
function add(value) {
    value = toRaw(value);
    const target = toRaw(this);
    const proto = Reflect.getPrototypeOf(this);
    const hadKey = proto.has.call(target, value);
    const result = proto.add.call(target, value);
    if (!hadKey) {
        trigger(target, "add" /* ADD */, value, { value });
    }
    return result;
}
function set$1(key, value) {
    value = toRaw(value);
    const target = toRaw(this);
    const proto = Reflect.getPrototypeOf(this);
    const hadKey = proto.has.call(target, key);
    const oldValue = proto.get.call(target, key);
    const result = proto.set.call(target, key, value);
    if (value !== oldValue) {
        const extraInfo = { oldValue, newValue: value };
        if (!hadKey) {
            trigger(target, "add" /* ADD */, key, extraInfo);
        } else {
            trigger(target, "set" /* SET */, key, extraInfo);
        }
    }
    return result;
}
function deleteEntry(key) {
    const target = toRaw(this);
    const proto = Reflect.getPrototypeOf(this);
    const hadKey = proto.has.call(target, key);
    const oldValue = proto.get ? proto.get.call(target, key) : undefined;
    // forward the operation before queueing reactions
    const result = proto.delete.call(target, key);
    if (hadKey) {
        trigger(target, "delete" /* DELETE */, key, { oldValue });
    }
    return result;
}
function clear() {
    const target = toRaw(this);
    const proto = Reflect.getPrototypeOf(this);
    const hadItems = target.size !== 0;
    const oldTarget = target instanceof Map ? new Map(target) : new Set(target);
    // forward the operation before queueing reactions
    const result = proto.clear.call(target);
    if (hadItems) {
        trigger(target, "clear" /* CLEAR */, void 0, { oldTarget });
    }
    return result;
}
function createForEach(isReadonly) {
    return function forEach(callback, thisArg) {
        const observed = this;
        const target = toRaw(observed);
        const proto = Reflect.getPrototypeOf(target);
        const wrap = isReadonly ? toReadonly : toReactive;
        track(target, "iterate" /* ITERATE */);
        // important: create sure the callback is
        // 1. invoked with the reactive map as `this` and 3rd arg
        // 2. the value received should be a corresponding reactive/readonly.
        function wrappedCallback(value, key) {
            return callback.call(observed, wrap(value), wrap(key), observed);
        }
        return proto.forEach.call(target, wrappedCallback, thisArg);
    };
}
function createIterableMethod(method, isReadonly) {
    return function (...args) {
        const target = toRaw(this);
        const proto = Reflect.getPrototypeOf(target);
        const isPair = method === 'entries' ||
            (method === Symbol.iterator && target instanceof Map);
        const innerIterator = proto[method].apply(target, args);
        const wrap = isReadonly ? toReadonly : toReactive;
        track(target, "iterate" /* ITERATE */);
        // return a wrapped iterator which returns observed versions of the
        // values emitted from the real iterator
        return {
            // iterator protocol
            next() {
                const { value, done } = innerIterator.next();
                return done
                    ? { value, done }
                    : {
                        value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
                        done
                    };
            },
            // iterable protocol
            [Symbol.iterator]() {
                return this;
            }
        };
    };
}
function createReadonlyMethod(method, type) {
    return function (...args) {
        if (LOCKED) {
            const key = args[0] ? `on key "${args[0]}" ` : ``;
            console.warn(`${capitalize(type)} operation ${key}failed: target is readonly.`, toRaw(this));
            return type === "delete" /* DELETE */ ? false : this;
        } else {
            return method.apply(this, args);
        }
    };
}
const mutableInstrumentations = {
    get(key) {
        return get(this, key, toReactive);
    },
    get size() {
        return size(this);
    },
    has: has$1,
    add,
    set: set$1,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false)
};
const readonlyInstrumentations = {
    get(key) {
        return get(this, key, toReadonly);
    },
    get size() {
        return size(this);
    },
    has: has$1,
    add: createReadonlyMethod(add, "add" /* ADD */),
    set: createReadonlyMethod(set$1, "set" /* SET */),
    delete: createReadonlyMethod(deleteEntry, "delete" /* DELETE */),
    clear: createReadonlyMethod(clear, "clear" /* CLEAR */),
    forEach: createForEach(true)
};
const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator];
iteratorMethods.forEach(method => {
    mutableInstrumentations[method] = createIterableMethod(method, false);
    readonlyInstrumentations[method] = createIterableMethod(method, true);
});
function createInstrumentationGetter(instrumentations) {
    return function getInstrumented(target, key, receiver) {
        target = hasOwn(instrumentations, key) && key in target ? instrumentations : target;
        return Reflect.get(target, key, receiver);
    };
}
const mutableCollectionHandlers = {
    get: createInstrumentationGetter(mutableInstrumentations)
};
const readonlyCollectionHandlers = {
    get: createInstrumentationGetter(readonlyInstrumentations)
};

const targetMap = new WeakMap();
// WeakMaps that store {raw <-> observed} pairs.
const rawToReactive = new WeakMap();
const reactiveToRaw = new WeakMap();
const rawToReadonly = new WeakMap();
const readonlyToRaw = new WeakMap();
// WeakSets for values that are marked readonly or non-reactive during
// observable creation.
const readonlyValues = new WeakSet();
const nonReactiveValues = new WeakSet();
const collectionTypes = new Set([Set, Map, WeakMap, WeakSet]);
const observableValueRE = /^\[object (?:Object|Array|Map|Set|WeakMap|WeakSet)\]$/;
const canObserve = (value) => {
    return (!value._isVue &&
        !value._isVNode &&
        observableValueRE.test(toTypeString(value)) &&
        !nonReactiveValues.has(value));
};
function reactive(target) {
    // if trying to observe a readonly proxy, return the readonly version.
    if (readonlyToRaw.has(target)) {
        return target;
    }
    // target is explicitly marked as readonly by user
    if (readonlyValues.has(target)) {
        return readonly(target);
    }
    return createReactiveObject(target, rawToReactive, reactiveToRaw, mutableHandlers, mutableCollectionHandlers);
}
function readonly(target) {
    // value is a mutable observable, retrieve its original and return a readonly version.
    if (reactiveToRaw.has(target)) {
        target = reactiveToRaw.get(target);
    }
    return createReactiveObject(target, rawToReadonly, readonlyToRaw, readonlyHandlers, readonlyCollectionHandlers);
}
function createReactiveObject(target, toProxy, toRaw, baseHandlers, collectionHandlers) {
    if (!isObject(target)) {
        console.warn(`value cannot be made reactive: ${String(target)}`);
        return target;
    }
    // target already has corresponding Proxy
    let observed = toProxy.get(target);
    if (observed !== void 0) {
        return observed;
    }
    // target is already a Proxy
    if (toRaw.has(target)) {
        return target;
    }
    // only a whitelist of value types can be observed.
    if (!canObserve(target)) {
        return target;
    }
    
    const handlers = collectionTypes.has(target.constructor)
        ? collectionHandlers
        : baseHandlers;
    observed = new Proxy(target, handlers);
    toProxy.set(target, observed);
    toRaw.set(observed, target);
    if (!targetMap.has(target)) {
        targetMap.set(target, new Map());
    }
    return observed;
}
function isReactive(value) {
    return reactiveToRaw.has(value) || readonlyToRaw.has(value);
}
function isReadonly(value) {
    return readonlyToRaw.has(value);
}
function toRaw(observed) {
    return reactiveToRaw.get(observed) || readonlyToRaw.get(observed) || observed;
}
function markReadonly(value) {
    readonlyValues.add(value);
    return value;
}
function markNonReactive(value) {
    nonReactiveValues.add(value);
    return value;
}

const activeReactiveEffectStack = [];
const ITERATE_KEY = Symbol('iterate');
function effect(fn, options = EMPTY_OBJ) {
    if (fn.isEffect) {
        fn = fn.raw;
    }
    const effect = createReactiveEffect(fn, options);
    if (!options.lazy) {
        effect();
    }
    return effect;
}
function stop(effect) {
    if (effect.active) {
        cleanup(effect);
        if (effect.onStop) {
            effect.onStop();
        }
        effect.active = false;
    }
}
function createReactiveEffect(fn, options) {
    const effect = function effect(...args) {
        return run(effect, fn, args);
    };
    effect.isEffect = true;
    effect.active = true;
    effect.raw = fn;
    effect.scheduler = options.scheduler;
    effect.onTrack = options.onTrack;
    effect.onTrigger = options.onTrigger;
    effect.onStop = options.onStop;
    effect.computed = options.computed;
    effect.deps = [];
    return effect;
}
function run(effect, fn, args) {
    if (!effect.active) {
        return fn(...args);
    }
    if (activeReactiveEffectStack.indexOf(effect) === -1) {
        cleanup(effect);
        try {
            activeReactiveEffectStack.push(effect);
            return fn(...args);
        }
        finally {
            activeReactiveEffectStack.pop();
        }
    }
}
function cleanup(effect) {
    const { deps } = effect;
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].delete(effect);
        }
        deps.length = 0;
    }
}
let shouldTrack = true;
function pauseTracking() {
    shouldTrack = false;
}
function resumeTracking() {
    shouldTrack = true;
}
function track(target, type, key) {
    if (!shouldTrack) {
        return;
    }
    const effect = activeReactiveEffectStack[activeReactiveEffectStack.length - 1];
    if (effect) {
        if (type === "iterate" /* ITERATE */) {
            key = ITERATE_KEY;
        }
        let depsMap = targetMap.get(target);
        if (depsMap === void 0) {
            targetMap.set(target, (depsMap = new Map()));
        }
        let dep = depsMap.get(key);
        if (!dep) {
            depsMap.set(key, (dep = new Set()));
        }
        if (!dep.has(effect)) {
            dep.add(effect);
            effect.deps.push(dep);
            if ( effect.onTrack) {
                effect.onTrack({
                    effect,
                    target,
                    type,
                    key
                });
            }
        }
    }
}
function trigger(target, type, key, extraInfo) {
    const depsMap = targetMap.get(target);
    if (depsMap === void 0) {
        // never been tracked
        return;
    }
    const effects = new Set();
    const computedRunners = new Set();
    if (type === "clear" /* CLEAR */) {
        // collection being cleared, trigger all effects for target
        depsMap.forEach(dep => {
            addRunners(effects, computedRunners, dep);
        });
    }
    else {
        // schedule runs for SET | ADD | DELETE
        if (key !== void 0) {
            addRunners(effects, computedRunners, depsMap.get(key));
        }
        // also run for iteration key on ADD | DELETE
        if (type === "add" /* ADD */ || type === "delete" /* DELETE */) {
            const iterationKey = Array.isArray(target) ? 'length' : ITERATE_KEY;
            addRunners(effects, computedRunners, depsMap.get(iterationKey));
        }
    }
    const run = (effect) => {
        scheduleRun(effect, target, type, key, extraInfo);
    };
    // Important: computed effects must be run first so that computed getters
    // can be invalidated before any normal effects that depend on them are run.
    computedRunners.forEach(run);
    effects.forEach(run);
}
function addRunners(effects, computedRunners, effectsToAdd) {
    if (effectsToAdd !== void 0) {
        effectsToAdd.forEach(effect => {
            if (effect.computed) {
                computedRunners.add(effect);
            }
            else {
                effects.add(effect);
            }
        });
    }
}
function scheduleRun(effect, target, type, key, extraInfo) {
    if ( effect.onTrigger) {
        effect.onTrigger(extend({
            effect,
            target,
            key,
            type
        }, extraInfo));
    }
    if (effect.scheduler !== void 0) {
        effect.scheduler(effect);
    }
    else {
        effect();
    }
}

const refSymbol = Symbol();
const convert = (val) => (isObject(val) ? reactive(val) : val);
function ref(raw) {
    raw = convert(raw);
    const v = {
        _isRef: refSymbol,
        get value() {
            track(v, "get" /* GET */, '');
            return raw;
        },
        set value(newVal) {
            raw = convert(newVal);
            trigger(v, "set" /* SET */, '');
        }
    };
    return v;
}
function isRef(v) {
    return v ? v._isRef === refSymbol : false;
}
function toRefs(object) {
    const ret = {};
    for (const key in object) {
        ret[key] = toProxyRef(object, key);
    }
    return ret;
}
function toProxyRef(object, key) {
    const v = {
        _isRef: refSymbol,
        get value() {
            return object[key];
        },
        set value(newVal) {
            object[key] = newVal;
        }
    };
    return v;
}

function computed(getterOrOptions) {
    const isReadonly = isFunction(getterOrOptions);
    const getter = isReadonly
        ? getterOrOptions
        : getterOrOptions.get;
    const setter = isReadonly
        ? () => {
            // TODO warn attempting to mutate readonly computed value
        }
        : getterOrOptions.set;
    let dirty = true;
    let value = undefined;
    const runner = effect(getter, {
        lazy: true,
        // mark effect as computed so that it gets priority during trigger
        computed: true,
        scheduler: () => {
            dirty = true;
        }
    });
    return {
        _isRef: refSymbol,
        // expose effect so computed can be stopped
        effect: runner,
        get value() {
            if (dirty) {
                value = runner();
                dirty = false;
            }
            // When computed effects are accessed in a parent effect, the parent
            // should track all the dependencies the computed property has tracked.
            // This should also apply for chained computed properties.
            trackChildRun(runner);
            return value;
        },
        set value(newValue) {
            setter(newValue);
        }
    };
}
function trackChildRun(childRunner) {
    const parentRunner = activeReactiveEffectStack[activeReactiveEffectStack.length - 1];
    if (parentRunner) {
        for (let i = 0; i < childRunner.deps.length; i++) {
            const dep = childRunner.deps[i];
            if (!dep.has(parentRunner)) {
                dep.add(parentRunner);
                parentRunner.deps.push(dep);
            }
        }
    }
}

let stack = [];
function pushWarningContext(vnode) {
    stack.push(vnode);
}
function popWarningContext() {
    stack.pop();
}
function warn(msg, ...args) {
    const instance = stack.length ? stack[stack.length - 1].component : null;
    const appWarnHandler = instance && instance.appContext.config.warnHandler;
    const trace = getComponentTrace();
    if (appWarnHandler) {
        appWarnHandler(msg + args.join(''), instance && instance.renderProxy, formatTrace(trace).join(''));
        return;
    }
    console.warn(`[Vue warn]: ${msg}`, ...args);
    // avoid spamming console during tests
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        return;
    }
    if (!trace.length) {
        return;
    }
    if (trace.length > 1 && console.groupCollapsed) {
        console.groupCollapsed('at', ...formatTraceEntry(trace[0]));
        const logs = [];
        trace.slice(1).forEach((entry, i) => {
            if (i !== 0)
                logs.push('\n');
            logs.push(...formatTraceEntry(entry, i + 1));
        });
        console.log(...logs);
        console.groupEnd();
    }
    else {
        console.log(...formatTrace(trace));
    }
}
function getComponentTrace() {
    let currentVNode = stack[stack.length - 1];
    if (!currentVNode) {
        return [];
    }
    // we can't just use the stack because it will be incomplete during updates
    // that did not start from the root. Re-construct the parent chain using
    // instance parent pointers.
    const normalizedStack = [];
    while (currentVNode) {
        const last = normalizedStack[0];
        if (last && last.vnode === currentVNode) {
            last.recurseCount++;
        }
        else {
            normalizedStack.push({
                vnode: currentVNode,
                recurseCount: 0
            });
        }
        const parentInstance = currentVNode.component
            .parent;
        currentVNode = parentInstance && parentInstance.vnode;
    }
    return normalizedStack;
}
function formatTrace(trace) {
    const logs = [];
    trace.forEach((entry, i) => {
        const formatted = formatTraceEntry(entry, i);
        if (i === 0) {
            logs.push('at', ...formatted);
        }
        else {
            logs.push('\n', ...formatted);
        }
    });
    return logs;
}
function formatTraceEntry({ vnode, recurseCount }, depth = 0) {
    const padding = depth === 0 ? '' : ' '.repeat(depth * 2 + 1);
    const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
    const open = padding + `<${formatComponentName(vnode)}`;
    const close = `>` + postfix;
    const rootLabel = vnode.component.parent == null ? `(Root)` : ``;
    return vnode.props
        ? [open, ...formatProps(vnode.props), close, rootLabel]
        : [open + close, rootLabel];
}
const classifyRE = /(?:^|[-_])(\w)/g;
const classify = (str) => str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '');
function formatComponentName(vnode, file) {
    const Component = vnode.type;
    let name = Component.displayName || Component.name;
    if (!name && file) {
        const match = file.match(/([^/\\]+)\.vue$/);
        if (match) {
            name = match[1];
        }
    }
    return name ? classify(name) : 'AnonymousComponent';
}
function formatProps(props) {
    const res = [];
    for (const key in props) {
        const value = props[key];
        if (isString(value)) {
            res.push(`${key}=${JSON.stringify(value)}`);
        }
        else {
            res.push(`${key}=`, toRaw(value));
        }
    }
    return res;
}

const ErrorTypeStrings = {
    ["bc" /* BEFORE_CREATE */]: 'beforeCreate hook',
    ["c" /* CREATED */]: 'created hook',
    ["bm" /* BEFORE_MOUNT */]: 'beforeMount hook',
    ["m" /* MOUNTED */]: 'mounted hook',
    ["bu" /* BEFORE_UPDATE */]: 'beforeUpdate hook',
    ["u" /* UPDATED */]: 'updated',
    ["bum" /* BEFORE_UNMOUNT */]: 'beforeUnmount hook',
    ["um" /* UNMOUNTED */]: 'unmounted hook',
    ["a" /* ACTIVATED */]: 'activated hook',
    ["da" /* DEACTIVATED */]: 'deactivated hook',
    ["ec" /* ERROR_CAPTURED */]: 'errorCaptured hook',
    ["rtc" /* RENDER_TRACKED */]: 'renderTracked hook',
    ["rtg" /* RENDER_TRIGGERED */]: 'renderTriggered hook',
    [0 /* SETUP_FUNCTION */]: 'setup function',
    [1 /* RENDER_FUNCTION */]: 'render function',
    [2 /* WATCH_GETTER */]: 'watcher getter',
    [3 /* WATCH_CALLBACK */]: 'watcher callback',
    [4 /* WATCH_CLEANUP */]: 'watcher cleanup function',
    [5 /* NATIVE_EVENT_HANDLER */]: 'native event handler',
    [6 /* COMPONENT_EVENT_HANDLER */]: 'component event handler',
    [7 /* DIRECTIVE_HOOK */]: 'directive hook',
    [8 /* APP_ERROR_HANDLER */]: 'app errorHandler',
    [9 /* APP_WARN_HANDLER */]: 'app warnHandler',
    [10 /* SCHEDULER */]: 'scheduler flush. This is likely a Vue internals bug. ' +
        'Please open an issue at https://new-issue.vuejs.org/?repo=vuejs/vue'
};
function callWithErrorHandling(fn, instance, type, args) {
    let res;
    try {
        res = args ? fn(...args) : fn();
    }
    catch (err) {
        handleError(err, instance, type);
    }
    return res;
}
function callWithAsyncErrorHandling(fn, instance, type, args) {
    const res = callWithErrorHandling(fn, instance, type, args);
    if (res != null && !res._isVue && typeof res.then === 'function') {
        res.catch((err) => {
            handleError(err, instance, type);
        });
    }
    return res;
}
function handleError(err, instance, type) {
    const contextVNode = instance ? instance.vnode : null;
    if (instance) {
        let cur = instance.parent;
        // the exposed instance is the render proxy to keep it consistent with 2.x
        const exposedInstance = instance.renderProxy;
        // in production the hook receives only the error code
        const errorInfo =  ErrorTypeStrings[type] ;
        while (cur) {
            const errorCapturedHooks = cur.ec;
            if (errorCapturedHooks !== null) {
                for (let i = 0; i < errorCapturedHooks.length; i++) {
                    if (errorCapturedHooks[i](err, exposedInstance, errorInfo)) {
                        return;
                    }
                }
            }
            cur = cur.parent;
        }
        // app-level handling
        const appErrorHandler = instance.appContext.config.errorHandler;
        if (appErrorHandler) {
            callWithErrorHandling(appErrorHandler, null, 8 /* APP_ERROR_HANDLER */, [err, exposedInstance, errorInfo]);
            return;
        }
    }
    logError(err, type, contextVNode);
}
function logError(err, type, contextVNode) {
    // default behavior is crash in prod & test, recover in dev.
    // TODO we should probably make this configurable via `createApp`
    if (
        !(typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
        const info = ErrorTypeStrings[type];
        if (contextVNode) {
            pushWarningContext(contextVNode);
        }
        warn(`Unhandled error${info ? ` during execution of ${info}` : ``}`);
        console.error(err);
        if (contextVNode) {
            popWarningContext();
        }
    }
    else {
        throw err;
    }
}

const queue = [];
const postFlushCbs = [];
const p = Promise.resolve();
let isFlushing = false;
function nextTick(fn) {
    return fn ? p.then(fn) : p;
}
function queueJob(job) {
    if (queue.indexOf(job) === -1) {
        queue.push(job);
        if (!isFlushing) {
            nextTick(flushJobs);
        }
    }
}
function queuePostFlushCb(cb) {
    if (Array.isArray(cb)) {
        postFlushCbs.push.apply(postFlushCbs, cb);
    }
    else {
        postFlushCbs.push(cb);
    }
    if (!isFlushing) {
        nextTick(flushJobs);
    }
}
const dedupe = (cbs) => Array.from(new Set(cbs));
function flushPostFlushCbs() {
    if (postFlushCbs.length) {
        const cbs = dedupe(postFlushCbs);
        postFlushCbs.length = 0;
        for (let i = 0; i < cbs.length; i++) {
            cbs[i]();
        }
    }
}
const RECURSION_LIMIT = 100;
function flushJobs(seenJobs) {
    isFlushing = true;
    let job;
    {
        seenJobs = seenJobs || new Map();
    }
    while ((job = queue.shift())) {
        {
            const seen = seenJobs;
            if (!seen.has(job)) {
                seen.set(job, 1);
            }
            else {
                const count = seen.get(job);
                if (count > RECURSION_LIMIT) {
                    throw new Error('Maximum recursive updates exceeded. ' +
                        "You may have code that is mutating state in your component's " +
                        'render function or updated hook.');
                }
                else {
                    seen.set(job, count + 1);
                }
            }
        }
        try {
            job();
        }
        catch (err) {
            handleError(err, null, 10 /* SCHEDULER */);
        }
    }
    flushPostFlushCbs();
    isFlushing = false;
    // some postFlushCb queued jobs!
    // keep flushing until it drains.
    if (queue.length) {
        flushJobs(seenJobs);
    }
}

const Fragment =  Symbol('Fragment') ;
const Text =  Symbol('Text') ;
const Comment =  Symbol('Empty') ;
const Portal =  Symbol('Portal') ;
const Suspense =  Symbol('Suspense') ;
// Since v-if and v-for are the two possible ways node structure can dynamically
// change, once we consider v-if branches and each v-for fragment a block, we
// can divide a template into nested blocks, and within each block the node
// structure would be stable. This allows us to skip most children diffing
// and only worry about the dynamic nodes (indicated by patch flags).
const blockStack = [];
// Open a block.
// This must be called before `createBlock`. It cannot be part of `createBlock`
// because the children of the block are evaluated before `createBlock` itself
// is called. The generated code typically looks like this:
//
//   function render() {
//     return (openBlock(),createBlock('div', null, [...]))
//   }
//
// disableTracking is true when creating a fragment block, since a fragment
// always diffs its children.
function openBlock(disableTracking) {
    blockStack.push(disableTracking ? null : []);
}
let shouldTrack$1 = true;
// Create a block root vnode. Takes the same exact arguments as `createVNode`.
// A block root keeps track of dynamic nodes within the block in the
// `dynamicChildren` array.
function createBlock(type, props, children, patchFlag, dynamicProps) {
    // avoid a block with optFlag tracking itself
    shouldTrack$1 = false;
    const vnode = createVNode(type, props, children, patchFlag, dynamicProps);
    shouldTrack$1 = true;
    const trackedNodes = blockStack.pop();
    vnode.dynamicChildren =
        trackedNodes && trackedNodes.length ? trackedNodes : EMPTY_ARR;
    // a block is always going to be patched
    trackDynamicNode(vnode);
    return vnode;
}
function isVNode(value) {
    return value ? value._isVNode === true : false;
}
function createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null) {
    // class & style normalization.
    if (props !== null) {
        // for reactive or proxy objects, we need to clone it to enable mutation.
        if (isReactive(props) || SetupProxySymbol in props) {
            props = extend({}, props);
        }
        // class normalization only needed if the vnode isn't generated by
        // compiler-optimized code
        if (props.class != null && !(patchFlag & 2 /* CLASS */)) {
            props.class = normalizeClass(props.class);
        }
        let { style } = props;
        if (style != null) {
            // reactive state objects need to be cloned since they are likely to be
            // mutated
            if (isReactive(style) && !isArray(style)) {
                style = extend({}, style);
            }
            props.style = normalizeStyle(style);
        }
    }
    // encode the vnode type information into a bitmap
    const shapeFlag = isString(type)
        ? 1 /* ELEMENT */
        : isObject(type)
            ? 4 /* STATEFUL_COMPONENT */
            : isFunction(type)
                ? 2 /* FUNCTIONAL_COMPONENT */
                : 0;
    const vnode = {
        _isVNode: true,
        type,
        props,
        key: (props && props.key) || null,
        ref: (props && props.ref) || null,
        children: null,
        component: null,
        suspense: null,
        el: null,
        anchor: null,
        target: null,
        shapeFlag,
        patchFlag,
        dynamicProps,
        dynamicChildren: null,
        appContext: null
    };
    normalizeChildren(vnode, children);
    // presence of a patch flag indicates this node needs patching on updates.
    // component nodes also should always be patched, because even if the
    // component doesn't need to update, it needs to persist the instance on to
    // the next vnode so that it can be properly unmounted later.
    if (shouldTrack$1 &&
        (patchFlag ||
            shapeFlag & 4 /* STATEFUL_COMPONENT */ ||
            shapeFlag & 2 /* FUNCTIONAL_COMPONENT */)) {
        trackDynamicNode(vnode);
    }
    return vnode;
}
function trackDynamicNode(vnode) {
    const currentBlockDynamicNodes = blockStack[blockStack.length - 1];
    if (currentBlockDynamicNodes != null) {
        currentBlockDynamicNodes.push(vnode);
    }
}
function cloneVNode(vnode) {
    return {
        _isVNode: true,
        type: vnode.type,
        props: vnode.props,
        key: vnode.key,
        ref: vnode.ref,
        children: vnode.children,
        target: vnode.target,
        shapeFlag: vnode.shapeFlag,
        patchFlag: vnode.patchFlag,
        dynamicProps: vnode.dynamicProps,
        dynamicChildren: vnode.dynamicChildren,
        appContext: vnode.appContext,
        // these should be set to null since they should only be present on
        // mounted VNodes. If they are somehow not null, this means we have
        // encountered an already-mounted vnode being used again.
        component: null,
        suspense: null,
        el: null,
        anchor: null
    };
}
function normalizeVNode(child) {
    if (child == null) {
        // empty placeholder
        return createVNode(Comment);
    }
    else if (isArray(child)) {
        // fragment
        return createVNode(Fragment, null, child);
    }
    else if (typeof child === 'object') {
        // already vnode, this should be the most common since compiled templates
        // always produce all-vnode children arrays
        return child.el === null ? child : cloneVNode(child);
    }
    else {
        // primitive types
        return createVNode(Text, null, child + '');
    }
}
function normalizeChildren(vnode, children) {
    let type = 0;
    if (children == null) {
        children = null;
    }
    else if (isArray(children)) {
        type = 16 /* ARRAY_CHILDREN */;
    }
    else if (typeof children === 'object') {
        type = 32 /* SLOTS_CHILDREN */;
    }
    else if (isFunction(children)) {
        children = { default: children };
        type = 32 /* SLOTS_CHILDREN */;
    }
    else {
        children = isString(children) ? children : children + '';
        type = 8 /* TEXT_CHILDREN */;
    }
    vnode.children = children;
    vnode.shapeFlag |= type;
}
function normalizeStyle(value) {
    if (isArray(value)) {
        const res = {};
        for (let i = 0; i < value.length; i++) {
            const normalized = normalizeStyle(value[i]);
            if (normalized) {
                for (const key in normalized) {
                    res[key] = normalized[key];
                }
            }
        }
        return res;
    }
    else if (isObject(value)) {
        return value;
    }
}
function normalizeClass(value) {
    let res = '';
    if (isString(value)) {
        res = value;
    }
    else if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            res += normalizeClass(value[i]) + ' ';
        }
    }
    else if (isObject(value)) {
        for (const name in value) {
            if (value[name]) {
                res += name + ' ';
            }
        }
    }
    return res.trim();
}
const handlersRE = /^on|^vnode/;
function mergeProps(...args) {
    const ret = {};
    extend(ret, args[0]);
    for (let i = 1; i < args.length; i++) {
        const toMerge = args[i];
        for (const key in toMerge) {
            if (key === 'class') {
                ret.class = normalizeClass([ret.class, toMerge.class]);
            }
            else if (key === 'style') {
                ret.style = normalizeStyle([ret.style, toMerge.style]);
            }
            else if (handlersRE.test(key)) {
                // on*, vnode*
                const existing = ret[key];
                ret[key] = existing
                    ? [].concat(existing, toMerge[key])
                    : toMerge[key];
            }
            else {
                ret[key] = toMerge[key];
            }
        }
    }
    return ret;
}

function injectHook(type, hook, target) {
    if (target) {
        (target[type] || (target[type] = [])).push((...args) => {
            if (target.isUnmounted) {
                return;
            }
            // disable tracking inside all lifecycle hooks
            // since they can potentially be called inside effects.
            pauseTracking();
            // Set currentInstance during hook invocation.
            // This assumes the hook does not synchronously trigger other hooks, which
            // can only be false when the user does something really funky.
            setCurrentInstance(target);
            const res = callWithAsyncErrorHandling(hook, target, type, args);
            setCurrentInstance(null);
            resumeTracking();
            return res;
        });
    }
    else {
        const apiName = `on${capitalize(ErrorTypeStrings[type].replace(/ hook$/, ''))}`;
        warn(`${apiName} is called when there is no active component instance to be ` +
            `associated with. ` +
            `Lifecycle injection APIs can only be used during execution of setup().` +
            ( ` If you are using async setup(), make sure to register lifecycle ` +
                    `hooks before the first await statement.`
                ));
    }
}
function onBeforeMount(hook, target = currentInstance) {
    injectHook("bm" /* BEFORE_MOUNT */, hook, target);
}
function onMounted(hook, target = currentInstance) {
    injectHook("m" /* MOUNTED */, hook, target);
}
function onBeforeUpdate(hook, target = currentInstance) {
    injectHook("bu" /* BEFORE_UPDATE */, hook, target);
}
function onUpdated(hook, target = currentInstance) {
    injectHook("u" /* UPDATED */, hook, target);
}
function onBeforeUnmount(hook, target = currentInstance) {
    injectHook("bum" /* BEFORE_UNMOUNT */, hook, target);
}
function onUnmounted(hook, target = currentInstance) {
    injectHook("um" /* UNMOUNTED */, hook, target);
}
function onRenderTriggered(hook, target = currentInstance) {
    injectHook("rtg" /* RENDER_TRIGGERED */, hook, target);
}
function onRenderTracked(hook, target = currentInstance) {
    injectHook("rtc" /* RENDER_TRACKED */, hook, target);
}
function onErrorCaptured(hook, target = currentInstance) {
    injectHook("ec" /* ERROR_CAPTURED */, hook, target);
}

// mark the current rendering instance for asset resolution (e.g.
// resolveComponent, resolveDirective) during render
let currentRenderingInstance = null;
function renderComponentRoot(instance) {
    const { type: Component, vnode, renderProxy, props, slots, attrs, emit } = instance;
    let result;
    currentRenderingInstance = instance;
    try {
        if (vnode.shapeFlag & 4 /* STATEFUL_COMPONENT */) {
            result = normalizeVNode(instance.render.call(renderProxy));
        }
        else {
            // functional
            const render = Component;
            result = normalizeVNode(render.length > 1
                ? render(props, {
                    attrs,
                    slots,
                    emit
                })
                : render(props, null));
        }
    }
    catch (err) {
        handleError(err, instance, 1 /* RENDER_FUNCTION */);
        result = createVNode(Comment);
    }
    currentRenderingInstance = null;
    return result;
}
function shouldUpdateComponent(prevVNode, nextVNode, optimized) {
    const { props: prevProps, children: prevChildren } = prevVNode;
    const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
    if (patchFlag > 0) {
        if (patchFlag & 256 /* DYNAMIC_SLOTS */) {
            // slot content that references values that might have changed,
            // e.g. in a v-for
            return true;
        }
        if (patchFlag & 16 /* FULL_PROPS */) {
            // presence of this flag indicates props are always non-null
            return hasPropsChanged(prevProps, nextProps);
        }
        else if (patchFlag & 8 /* PROPS */) {
            const dynamicProps = nextVNode.dynamicProps;
            for (let i = 0; i < dynamicProps.length; i++) {
                const key = dynamicProps[i];
                if (nextProps[key] !== prevProps[key]) {
                    return true;
                }
            }
        }
    }
    else if (!optimized) {
        // this path is only taken by manually written render functions
        // so presence of any children leads to a forced update
        if (prevChildren != null || nextChildren != null) {
            return true;
        }
        if (prevProps === nextProps) {
            return false;
        }
        if (prevProps === null) {
            return nextProps !== null;
        }
        if (nextProps === null) {
            return prevProps !== null;
        }
        return hasPropsChanged(prevProps, nextProps);
    }
    return false;
}
function hasPropsChanged(prevProps, nextProps) {
    const nextKeys = Object.keys(nextProps);
    if (nextKeys.length !== Object.keys(prevProps).length) {
        return true;
    }
    for (let i = 0; i < nextKeys.length; i++) {
        const key = nextKeys[i];
        if (nextProps[key] !== prevProps[key]) {
            return true;
        }
    }
    return false;
}

// resolve raw VNode data.
// - filter out reserved keys (key, ref, slots)
// - extract class and style into $attrs (to be merged onto child
//   component root)
// - for the rest:
//   - if has declared props: put declared ones in `props`, the rest in `attrs`
//   - else: everything goes in `props`.
function resolveProps(instance, rawProps, _options) {
    const hasDeclaredProps = _options != null;
    const options = normalizePropsOptions(_options);
    if (!rawProps && !hasDeclaredProps) {
        return;
    }
    const props = {};
    let attrs = void 0;
    // update the instance propsProxy (passed to setup()) to trigger potential
    // changes
    const propsProxy = instance.propsProxy;
    const setProp = propsProxy
        ? (key, val) => {
            props[key] = val;
            propsProxy[key] = val;
        }
        : (key, val) => {
            props[key] = val;
        };
    // allow mutation of propsProxy (which is readonly by default)
    unlock();
    if (rawProps != null) {
        for (const key in rawProps) {
            // key, ref are reserved
            if (isReservedProp(key))
                continue;
            // any non-declared data are put into a separate `attrs` object
            // for spreading
            if (hasDeclaredProps && !hasOwn(options, key)) {
                (attrs || (attrs = {}))[key] = rawProps[key];
            }
            else {
                setProp(key, rawProps[key]);
            }
        }
    }
    // set default values, cast booleans & run validators
    if (hasDeclaredProps) {
        for (const key in options) {
            let opt = options[key];
            if (opt == null)
                continue;
            const isAbsent = !hasOwn(props, key);
            const hasDefault = hasOwn(opt, 'default');
            const currentValue = props[key];
            // default values
            if (hasDefault && currentValue === undefined) {
                const defaultValue = opt.default;
                setProp(key, isFunction(defaultValue) ? defaultValue() : defaultValue);
            }
            // boolean casting
            if (opt["1" /* shouldCast */]) {
                if (isAbsent && !hasDefault) {
                    setProp(key, false);
                }
                else if (opt["2" /* shouldCastTrue */] &&
                    (currentValue === '' || currentValue === hyphenate(key))) {
                    setProp(key, true);
                }
            }
            // runtime validation
            if ( rawProps) {
                validateProp(key, toRaw(rawProps[key]), opt, isAbsent);
            }
        }
    }
    else {
        // if component has no declared props, $attrs === $props
        attrs = props;
    }
    // in case of dynamic props, check if we need to delete keys from
    // the props proxy
    const { patchFlag } = instance.vnode;
    if (propsProxy !== null &&
        (patchFlag === 0 || patchFlag & 16 /* FULL_PROPS */)) {
        const rawInitialProps = toRaw(propsProxy);
        for (const key in rawInitialProps) {
            if (!hasOwn(props, key)) {
                delete propsProxy[key];
            }
        }
    }
    // lock readonly
    lock();
    instance.props =  readonly(props) ;
    instance.attrs = options
        ?  attrs != null
            ? readonly(attrs)
            : attrs
        : instance.props;
}
const normalizationMap = new WeakMap();
function normalizePropsOptions(raw) {
    if (!raw) {
        return null;
    }
    if (normalizationMap.has(raw)) {
        return normalizationMap.get(raw);
    }
    const normalized = {};
    normalizationMap.set(raw, normalized);
    if (isArray(raw)) {
        for (let i = 0; i < raw.length; i++) {
            if ( !isString(raw[i])) {
                warn(`props must be strings when using array syntax.`, raw[i]);
            }
            const normalizedKey = camelize(raw[i]);
            if (normalizedKey[0] !== '$') {
                normalized[normalizedKey] = EMPTY_OBJ;
            }
            else {
                warn(`Invalid prop name: "${normalizedKey}" is a reserved property.`);
            }
        }
    }
    else {
        if ( !isObject(raw)) {
            warn(`invalid props options`, raw);
        }
        for (const key in raw) {
            const normalizedKey = camelize(key);
            if (normalizedKey[0] !== '$') {
                const opt = raw[key];
                const prop = (normalized[normalizedKey] =
                    isArray(opt) || isFunction(opt) ? { type: opt } : opt);
                if (prop != null) {
                    const booleanIndex = getTypeIndex(Boolean, prop.type);
                    const stringIndex = getTypeIndex(String, prop.type);
                    prop["1" /* shouldCast */] = booleanIndex > -1;
                    prop["2" /* shouldCastTrue */] = booleanIndex < stringIndex;
                }
            }
            else {
                warn(`Invalid prop name: "${normalizedKey}" is a reserved property.`);
            }
        }
    }
    return normalized;
}
// use function string name to check type constructors
// so that it works across vms / iframes.
function getType(ctor) {
    const match = ctor && ctor.toString().match(/^\s*function (\w+)/);
    return match ? match[1] : '';
}
function isSameType(a, b) {
    return getType(a) === getType(b);
}
function getTypeIndex(type, expectedTypes) {
    if (isArray(expectedTypes)) {
        for (let i = 0, len = expectedTypes.length; i < len; i++) {
            if (isSameType(expectedTypes[i], type)) {
                return i;
            }
        }
    }
    else if (isObject(expectedTypes)) {
        return isSameType(expectedTypes, type) ? 0 : -1;
    }
    return -1;
}
function validateProp(name, value, prop, isAbsent) {
    const { type, required, validator } = prop;
    // required!
    if (required && isAbsent) {
        warn('Missing required prop: "' + name + '"');
        return;
    }
    // missing but optional
    if (value == null && !prop.required) {
        return;
    }
    // type check
    if (type != null && type !== true) {
        let isValid = false;
        const types = isArray(type) ? type : [type];
        const expectedTypes = [];
        // value is valid as long as one of the specified types match
        for (let i = 0; i < types.length && !isValid; i++) {
            const { valid, expectedType } = assertType(value, types[i]);
            expectedTypes.push(expectedType || '');
            isValid = valid;
        }
        if (!isValid) {
            warn(getInvalidTypeMessage(name, value, expectedTypes));
            return;
        }
    }
    // custom validator
    if (validator && !validator(value)) {
        warn('Invalid prop: custom validator check failed for prop "' + name + '".');
    }
}
const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/;
function assertType(value, type) {
    let valid;
    const expectedType = getType(type);
    if (simpleCheckRE.test(expectedType)) {
        const t = typeof value;
        valid = t === expectedType.toLowerCase();
        // for primitive wrapper objects
        if (!valid && t === 'object') {
            valid = value instanceof type;
        }
    }
    else if (expectedType === 'Object') {
        valid = toRawType(value) === 'Object';
    }
    else if (expectedType === 'Array') {
        valid = isArray(value);
    }
    else {
        valid = value instanceof type;
    }
    return {
        valid,
        expectedType
    };
}
function getInvalidTypeMessage(name, value, expectedTypes) {
    let message = `Invalid prop: type check failed for prop "${name}".` +
        ` Expected ${expectedTypes.map(capitalize).join(', ')}`;
    const expectedType = expectedTypes[0];
    const receivedType = toRawType(value);
    const expectedValue = styleValue(value, expectedType);
    const receivedValue = styleValue(value, receivedType);
    // check if we need to specify expected value
    if (expectedTypes.length === 1 &&
        isExplicable(expectedType) &&
        !isBoolean(expectedType, receivedType)) {
        message += ` with value ${expectedValue}`;
    }
    message += `, got ${receivedType} `;
    // check if we need to specify received value
    if (isExplicable(receivedType)) {
        message += `with value ${receivedValue}.`;
    }
    return message;
}
function styleValue(value, type) {
    if (type === 'String') {
        return `"${value}"`;
    }
    else if (type === 'Number') {
        return `${Number(value)}`;
    }
    else {
        return `${value}`;
    }
}
function toRawType(value) {
    return toTypeString(value).slice(8, -1);
}
function isExplicable(type) {
    const explicitTypes = ['string', 'number', 'boolean'];
    return explicitTypes.some(elem => type.toLowerCase() === elem);
}
function isBoolean(...args) {
    return args.some(elem => elem.toLowerCase() === 'boolean');
}

const normalizeSlotValue = (value) => isArray(value)
    ? value.map(normalizeVNode)
    : [normalizeVNode(value)];
const normalizeSlot = (key, rawSlot) => (props) => {
    if ( currentInstance != null) {
        warn(`Slot "${key}" invoked outside of the render function: ` +
            `this will not track dependencies used in the slot. ` +
            `Invoke the slot function inside the render function instead.`);
    }
    return normalizeSlotValue(rawSlot(props));
};
function resolveSlots(instance, children) {
    let slots;
    if (instance.vnode.shapeFlag & 32 /* SLOTS_CHILDREN */) {
        if (children._compiled) {
            // pre-normalized slots object generated by compiler
            slots = children;
        }
        else {
            slots = {};
            for (const key in children) {
                let value = children[key];
                if (isFunction(value)) {
                    slots[key] = normalizeSlot(key, value);
                }
                else if (value != null) {
                    {
                        warn(`Non-function value encountered for slot "${key}". ` +
                            `Prefer function slots for better performance.`);
                    }
                    value = normalizeSlotValue(value);
                    slots[key] = () => value;
                }
            }
        }
    }
    else if (children !== null) {
        // non slot object children (direct value) passed to a component
        {
            warn(`Non-function value encountered for default slot. ` +
                `Prefer function slots for better performance.`);
        }
        const normalized = normalizeSlotValue(children);
        slots = { default: () => normalized };
    }
    if (slots !== void 0) {
        instance.slots = slots;
    }
}

/**
Runtime helper for applying directives to a vnode. Example usage:

const comp = resolveComponent('comp')
const foo = resolveDirective('foo')
const bar = resolveDirective('bar')

return applyDirectives(h(comp), [
  [foo, this.x],
  [bar, this.y]
])
*/
const valueCache = new WeakMap();
function applyDirective(props, instance, directive, value, arg, modifiers) {
    let valueCacheForDir = valueCache.get(directive);
    if (!valueCacheForDir) {
        valueCacheForDir = new WeakMap();
        valueCache.set(directive, valueCacheForDir);
    }
    for (const key in directive) {
        const hook = directive[key];
        const hookKey = `vnode` + key[0].toUpperCase() + key.slice(1);
        const vnodeHook = (vnode, prevVNode) => {
            let oldValue;
            if (prevVNode != null) {
                oldValue = valueCacheForDir.get(prevVNode);
                valueCacheForDir.delete(prevVNode);
            }
            valueCacheForDir.set(vnode, value);
            hook(vnode.el, {
                instance: instance.renderProxy,
                value,
                oldValue,
                arg,
                modifiers
            }, vnode, prevVNode);
        };
        const existing = props[hookKey];
        props[hookKey] = existing
            ? [].concat(existing, vnodeHook)
            : vnodeHook;
    }
}
function applyDirectives(vnode, directives) {
    const instance = currentRenderingInstance;
    if (instance !== null) {
        vnode = cloneVNode(vnode);
        vnode.props = vnode.props != null ? extend({}, vnode.props) : {};
        for (let i = 0; i < directives.length; i++) {
            applyDirective(vnode.props, instance, ...directives[i]);
        }
    }
    else {
        warn(`applyDirectives can only be used inside render functions.`);
    }
    return vnode;
}
function invokeDirectiveHook(hook, instance, vnode, prevVNode = null) {
    const args = [vnode, prevVNode];
    if (isArray(hook)) {
        for (let i = 0; i < hook.length; i++) {
            callWithAsyncErrorHandling(hook[i], instance, 7 /* DIRECTIVE_HOOK */, args);
        }
    }
    else if (isFunction(hook)) {
        callWithAsyncErrorHandling(hook, instance, 7 /* DIRECTIVE_HOOK */, args);
    }
}

function createAppContext() {
    return {
        config: {
            devtools: true,
            performance: false,
            errorHandler: undefined,
            warnHandler: undefined
        },
        mixins: [],
        components: {},
        directives: {},
        provides: {}
    };
}
function createAppAPI(render) {
    return function createApp() {
        const context = createAppContext();
        let isMounted = false;
        const app = {
            get config() {
                return context.config;
            },
            set config(v) {
                {
                    warn(`app.config cannot be replaced. Modify individual options instead.`);
                }
            },
            use(plugin) {
                if (isFunction(plugin)) {
                    plugin(app);
                }
                else if (isFunction(plugin.install)) {
                    plugin.install(app);
                }
                else {
                    warn(`A plugin must either be a function or an object with an "install" ` +
                        `function.`);
                }
                return app;
            },
            mixin(mixin) {
                context.mixins.push(mixin);
                return app;
            },
            component(name, component) {
                // TODO component name validation
                if (!component) {
                    return context.components[name];
                }
                else {
                    context.components[name] = component;
                    return app;
                }
            },
            directive(name, directive) {
                // TODO directive name validation
                if (!directive) {
                    return context.directives[name];
                }
                else {
                    context.directives[name] = directive;
                    return app;
                }
            },
            mount(rootComponent, rootContainer, rootProps) {
                if (!isMounted) {
                    const vnode = createVNode(rootComponent, rootProps);
                    // store app context on the root VNode.
                    // this will be set on the root instance on initial mount.
                    vnode.appContext = context;
                    render(vnode, rootContainer);
                    isMounted = true;
                    return vnode.component.renderProxy;
                }
                else {
                    warn(`App has already been mounted. Create a new app instance instead.`);
                }
            },
            provide(key, value) {
                if ( key in context.provides) {
                    warn(`App already provides property with key "${key}". ` +
                        `It will be overwritten with the new value.`);
                }
                context.provides[key] = value;
            }
        };
        return app;
    };
}

function createSuspenseBoundary(vnode, parent, parentComponent, container, hiddenContainer, anchor, isSVG, optimized) {
    return {
        vnode,
        parent,
        parentComponent,
        isSVG,
        optimized,
        container,
        hiddenContainer,
        anchor,
        deps: 0,
        subTree: null,
        fallbackTree: null,
        isResolved: false,
        isUnmounted: false,
        effects: []
    };
}
function normalizeSuspenseChildren(vnode) {
    const { shapeFlag, children } = vnode;
    if (shapeFlag & PublicShapeFlags.SLOTS_CHILDREN) {
        const { default: d, fallback } = children;
        return {
            content: normalizeVNode(isFunction(d) ? d() : d),
            fallback: normalizeVNode(isFunction(fallback) ? fallback() : fallback)
        };
    }
    else {
        return {
            content: normalizeVNode(children),
            fallback: normalizeVNode(null)
        };
    }
}

function createDevEffectOptions(instance) {
    return {
        scheduler: queueJob,
        onTrack: instance.rtc ? e => invokeHooks(instance.rtc, e) : void 0,
        onTrigger: instance.rtg ? e => invokeHooks(instance.rtg, e) : void 0
    };
}
function isSameType$1(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key;
}
function invokeHooks(hooks, arg) {
    for (let i = 0; i < hooks.length; i++) {
        hooks[i](arg);
    }
}
function queuePostRenderEffect(fn, suspense) {
    if (suspense !== null && !suspense.isResolved) {
        if (isArray(fn)) {
            suspense.effects.push(...fn);
        }
        else {
            suspense.effects.push(fn);
        }
    }
    else {
        queuePostFlushCb(fn);
    }
}
/**
 * The createRenderer function accepts two generic arguments:
 * HostNode and HostElement, corresponding to Node and Element types in the
 * host environment. For example, for runtime-dom, HostNode would be the DOM
 * `Node` interface and HostElement would be the DOM `Element` interface.
 *
 * Custom renderers can pass in the platform specific types like this:
 *
 * ``` js
 * const { render, createApp } = createRenderer<Node, Element>({
 *   patchProp,
 *   ...nodeOps
 * })
 * ```
 */
function createRenderer(options) {
    const { insert: hostInsert, remove: hostRemove, patchProp: hostPatchProp, createElement: hostCreateElement, createText: hostCreateText, createComment: hostCreateComment, setText: hostSetText, setElementText: hostSetElementText, parentNode: hostParentNode, nextSibling: hostNextSibling, querySelector: hostQuerySelector } = options;
    function patch(n1, // null means this is a mount
    n2, container, anchor = null, parentComponent = null, parentSuspense = null, isSVG = false, optimized = false) {
        // patching & not same type, unmount old tree
        if (n1 != null && !isSameType$1(n1, n2)) {
            anchor = getNextHostNode(n1);
            unmount(n1, parentComponent, parentSuspense, true);
            n1 = null;
        }
        const { type, shapeFlag } = n2;
        switch (type) {
            case Text:
                processText(n1, n2, container, anchor);
                break;
            case Comment:
                processCommentNode(n1, n2, container, anchor);
                break;
            case Fragment:
                processFragment(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                break;
            case Portal:
                processPortal(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                break;
            case Suspense:
                {
                    processSuspense(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                }
                break;
            default:
                if (shapeFlag & 1 /* ELEMENT */) {
                    processElement(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                }
                else if (shapeFlag & 6 /* COMPONENT */) {
                    processComponent(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                }
                else {
                    warn('Invalid HostVNode type:', n2.type, `(${typeof n2.type})`);
                }
        }
    }
    function processText(n1, n2, container, anchor) {
        if (n1 == null) {
            hostInsert((n2.el = hostCreateText(n2.children)), container, anchor);
        }
        else {
            const el = (n2.el = n1.el);
            if (n2.children !== n1.children) {
                hostSetText(el, n2.children);
            }
        }
    }
    function processCommentNode(n1, n2, container, anchor) {
        if (n1 == null) {
            hostInsert((n2.el = hostCreateComment(n2.children || '')), container, anchor);
        }
        else {
            // there's no support for dynamic comments
            n2.el = n1.el;
        }
    }
    function processElement(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        if (n1 == null) {
            mountElement(n2, container, anchor, parentComponent, parentSuspense, isSVG);
        }
        else {
            patchElement(n1, n2, parentComponent, parentSuspense, isSVG, optimized);
        }
        if (n2.ref !== null && parentComponent !== null) {
            setRef(n2.ref, n1 && n1.ref, parentComponent, n2.el);
        }
    }
    function mountElement(vnode, container, anchor, parentComponent, parentSuspense, isSVG) {
        const tag = vnode.type;
        isSVG = isSVG || tag === 'svg';
        const el = (vnode.el = hostCreateElement(tag, isSVG));
        const { props, shapeFlag } = vnode;
        if (props != null) {
            for (const key in props) {
                if (isReservedProp(key))
                    continue;
                hostPatchProp(el, key, props[key], null, isSVG);
            }
            if (props.vnodeBeforeMount != null) {
                invokeDirectiveHook(props.vnodeBeforeMount, parentComponent, vnode);
            }
        }
        if (shapeFlag & 8 /* TEXT_CHILDREN */) {
            hostSetElementText(el, vnode.children);
        }
        else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
            mountChildren(vnode.children, el, null, parentComponent, parentSuspense, isSVG);
        }
        hostInsert(el, container, anchor);
        if (props != null && props.vnodeMounted != null) {
            queuePostRenderEffect(() => {
                invokeDirectiveHook(props.vnodeMounted, parentComponent, vnode);
            }, parentSuspense);
        }
    }
    function mountChildren(children, container, anchor, parentComponent, parentSuspense, isSVG, start = 0) {
        for (let i = start; i < children.length; i++) {
            const child = (children[i] = normalizeVNode(children[i]));
            patch(null, child, container, anchor, parentComponent, parentSuspense, isSVG);
        }
    }
    function patchElement(n1, n2, parentComponent, parentSuspense, isSVG, optimized) {
        const el = (n2.el = n1.el);
        const { patchFlag, dynamicChildren } = n2;
        const oldProps = (n1 && n1.props) || EMPTY_OBJ;
        const newProps = n2.props || EMPTY_OBJ;
        if (newProps.vnodeBeforeUpdate != null) {
            invokeDirectiveHook(newProps.vnodeBeforeUpdate, parentComponent, n2, n1);
        }
        if (patchFlag > 0) {
            // the presence of a patchFlag means this element's render code was
            // generated by the compiler and can take the fast path.
            // in this path old node and new node are guaranteed to have the same shape
            // (i.e. at the exact same position in the source template)
            if (patchFlag & 16 /* FULL_PROPS */) {
                // element props contain dynamic keys, full diff needed
                patchProps(el, n2, oldProps, newProps, parentComponent, parentSuspense, isSVG);
            }
            else {
                // class
                // this flag is matched when the element has dynamic class bindings.
                if (patchFlag & 2 /* CLASS */) {
                    if (oldProps.class !== newProps.class) {
                        hostPatchProp(el, 'class', newProps.class, null, isSVG);
                    }
                }
                // style
                // this flag is matched when the element has dynamic style bindings
                if (patchFlag & 4 /* STYLE */) {
                    hostPatchProp(el, 'style', newProps.style, oldProps.style, isSVG);
                }
                // props
                // This flag is matched when the element has dynamic prop/attr bindings
                // other than class and style. The keys of dynamic prop/attrs are saved for
                // faster iteration.
                // Note dynamic keys like :[foo]="bar" will cause this optimization to
                // bail out and go through a full diff because we need to unset the old key
                if (patchFlag & 8 /* PROPS */) {
                    // if the flag is present then dynamicProps must be non-null
                    const propsToUpdate = n2.dynamicProps;
                    for (let i = 0; i < propsToUpdate.length; i++) {
                        const key = propsToUpdate[i];
                        const prev = oldProps[key];
                        const next = newProps[key];
                        if (prev !== next) {
                            hostPatchProp(el, key, next, prev, isSVG, n1.children, parentComponent, parentSuspense, unmountChildren);
                        }
                    }
                }
            }
            // text
            // This flag is matched when the element has only dynamic text children.
            // this flag is terminal (i.e. skips children diffing).
            if (patchFlag & 1 /* TEXT */) {
                if (n1.children !== n2.children) {
                    hostSetElementText(el, n2.children);
                }
                return; // terminal
            }
        }
        else if (!optimized) {
            // unoptimized, full diff
            patchProps(el, n2, oldProps, newProps, parentComponent, parentSuspense, isSVG);
        }
        if (dynamicChildren != null) {
            // children fast path
            const oldDynamicChildren = n1.dynamicChildren;
            for (let i = 0; i < dynamicChildren.length; i++) {
                patch(oldDynamicChildren[i], dynamicChildren[i], el, null, parentComponent, parentSuspense, isSVG, true);
            }
        }
        else if (!optimized) {
            // full diff
            patchChildren(n1, n2, el, null, parentComponent, parentSuspense, isSVG);
        }
        if (newProps.vnodeUpdated != null) {
            queuePostRenderEffect(() => {
                invokeDirectiveHook(newProps.vnodeUpdated, parentComponent, n2, n1);
            }, parentSuspense);
        }
    }
    function patchProps(el, vnode, oldProps, newProps, parentComponent, parentSuspense, isSVG) {
        if (oldProps !== newProps) {
            for (const key in newProps) {
                if (isReservedProp(key))
                    continue;
                const next = newProps[key];
                const prev = oldProps[key];
                if (next !== prev) {
                    hostPatchProp(el, key, next, prev, isSVG, vnode.children, parentComponent, parentSuspense, unmountChildren);
                }
            }
            if (oldProps !== EMPTY_OBJ) {
                for (const key in oldProps) {
                    if (isReservedProp(key))
                        continue;
                    if (!(key in newProps)) {
                        hostPatchProp(el, key, null, null, isSVG, vnode.children, parentComponent, parentSuspense, unmountChildren);
                    }
                }
            }
        }
    }
    function processFragment(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateComment(''));
        const fragmentEndAnchor = (n2.anchor = n1
            ? n1.anchor
            : hostCreateComment(''));
        if (n1 == null) {
            hostInsert(fragmentStartAnchor, container, anchor);
            hostInsert(fragmentEndAnchor, container, anchor);
            // a fragment can only have array children
            // since they are either generated by the compiler, or implicitly created
            // from arrays.
            mountChildren(n2.children, container, fragmentEndAnchor, parentComponent, parentSuspense, isSVG);
        }
        else {
            patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent, parentSuspense, isSVG, optimized);
        }
    }
    function processPortal(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        const targetSelector = n2.props && n2.props.target;
        const { patchFlag, shapeFlag, children } = n2;
        if (n1 == null) {
            const target = (n2.target = isString(targetSelector)
                ? hostQuerySelector(targetSelector)
                : null);
            if (target != null) {
                if (shapeFlag & 8 /* TEXT_CHILDREN */) {
                    hostSetElementText(target, children);
                }
                else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    mountChildren(children, target, null, parentComponent, parentSuspense, isSVG);
                }
            }
            else {
                warn('Invalid Portal target on mount:', target, `(${typeof target})`);
            }
        }
        else {
            // update content
            const target = (n2.target = n1.target);
            if (patchFlag === 1 /* TEXT */) {
                hostSetElementText(target, children);
            }
            else if (!optimized) {
                patchChildren(n1, n2, target, null, parentComponent, parentSuspense, isSVG);
            }
            // target changed
            if (targetSelector !== (n1.props && n1.props.target)) {
                const nextTarget = (n2.target = isString(targetSelector)
                    ? hostQuerySelector(targetSelector)
                    : null);
                if (nextTarget != null) {
                    // move content
                    if (shapeFlag & 8 /* TEXT_CHILDREN */) {
                        hostSetElementText(target, '');
                        hostSetElementText(nextTarget, children);
                    }
                    else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                        for (let i = 0; i < children.length; i++) {
                            move(children[i], nextTarget, null);
                        }
                    }
                }
                else {
                    warn('Invalid Portal target on update:', target, `(${typeof target})`);
                }
            }
        }
        // insert an empty node as the placeholder for the portal
        processCommentNode(n1, n2, container, anchor);
    }
    function processSuspense(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        if (n1 == null) {
            mountSuspense(n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
        }
        else {
            patchSuspense(n1, n2, container, anchor, parentComponent, isSVG, optimized);
        }
    }
    function mountSuspense(n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        const hiddenContainer = hostCreateElement('div');
        const suspense = (n2.suspense = createSuspenseBoundary(n2, parentSuspense, parentComponent, container, hiddenContainer, anchor, isSVG, optimized));
        const { content, fallback } = normalizeSuspenseChildren(n2);
        suspense.subTree = content;
        suspense.fallbackTree = fallback;
        // start mounting the content subtree in an off-dom container
        patch(null, content, hiddenContainer, null, parentComponent, suspense, isSVG, optimized);
        // now check if we have encountered any async deps
        if (suspense.deps > 0) {
            // mount the fallback tree
            patch(null, fallback, container, anchor, parentComponent, null, // fallback tree will not have suspense context
            isSVG, optimized);
            n2.el = fallback.el;
        }
        else {
            // Suspense has no async deps. Just resolve.
            resolveSuspense(suspense);
        }
    }
    function patchSuspense(n1, n2, container, anchor, parentComponent, isSVG, optimized) {
        const suspense = (n2.suspense = n1.suspense);
        suspense.vnode = n2;
        const { content, fallback } = normalizeSuspenseChildren(n2);
        const oldSubTree = suspense.subTree;
        const oldFallbackTree = suspense.fallbackTree;
        if (!suspense.isResolved) {
            patch(oldSubTree, content, suspense.hiddenContainer, null, parentComponent, suspense, isSVG, optimized);
            if (suspense.deps > 0) {
                // still pending. patch the fallback tree.
                patch(oldFallbackTree, fallback, container, anchor, parentComponent, null, // fallback tree will not have suspense context
                isSVG, optimized);
                n2.el = fallback.el;
            }
            // If deps somehow becomes 0 after the patch it means the patch caused an
            // async dep component to unmount and removed its dep. It will cause the
            // suspense to resolve and we don't need to do anything here.
        }
        else {
            // just normal patch inner content as a fragment
            patch(oldSubTree, content, container, anchor, parentComponent, suspense, isSVG, optimized);
            n2.el = content.el;
        }
        suspense.subTree = content;
        suspense.fallbackTree = fallback;
    }
    function resolveSuspense(suspense) {
        {
            if (suspense.isResolved) {
                throw new Error(`resolveSuspense() is called on an already resolved suspense boundary.`);
            }
            if (suspense.isUnmounted) {
                throw new Error(`resolveSuspense() is called on an already unmounted suspense boundary.`);
            }
        }
        const { vnode, subTree, fallbackTree, effects, parentComponent, container } = suspense;
        // this is initial anchor on mount
        let { anchor } = suspense;
        // unmount fallback tree
        if (fallbackTree.el) {
            // if the fallback tree was mounted, it may have been moved
            // as part of a parent suspense. get the latest anchor for insertion
            anchor = getNextHostNode(fallbackTree);
            unmount(fallbackTree, parentComponent, suspense, true);
        }
        // move content from off-dom container to actual container
        move(subTree, container, anchor);
        const el = (vnode.el = subTree.el);
        // suspense as the root node of a component...
        if (parentComponent && parentComponent.subTree === vnode) {
            parentComponent.vnode.el = el;
            updateHOCHostEl(parentComponent, el);
        }
        // check if there is a pending parent suspense
        let parent = suspense.parent;
        let hasUnresolvedAncestor = false;
        while (parent) {
            if (!parent.isResolved) {
                // found a pending parent suspense, merge buffered post jobs
                // into that parent
                parent.effects.push(...effects);
                hasUnresolvedAncestor = true;
                break;
            }
            parent = parent.parent;
        }
        // no pending parent suspense, flush all jobs
        if (!hasUnresolvedAncestor) {
            queuePostFlushCb(effects);
        }
        suspense.isResolved = true;
        // invoke @resolve event
        const onResolve = vnode.props && vnode.props.onResolve;
        if (isFunction(onResolve)) {
            onResolve();
        }
    }
    function restartSuspense(suspense) {
        suspense.isResolved = false;
        const { vnode, subTree, fallbackTree, parentComponent, container, hiddenContainer, isSVG, optimized } = suspense;
        // move content tree back to the off-dom container
        const anchor = getNextHostNode(subTree);
        move(subTree, hiddenContainer, null);
        // remount the fallback tree
        patch(null, fallbackTree, container, anchor, parentComponent, null, // fallback tree will not have suspense context
        isSVG, optimized);
        const el = (vnode.el = fallbackTree.el);
        // suspense as the root node of a component...
        if (parentComponent && parentComponent.subTree === vnode) {
            parentComponent.vnode.el = el;
            updateHOCHostEl(parentComponent, el);
        }
        // invoke @suspense event
        const onSuspense = vnode.props && vnode.props.onSuspense;
        if (isFunction(onSuspense)) {
            onSuspense();
        }
    }
    function processComponent(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        if (n1 == null) {
            mountComponent(n2, container, anchor, parentComponent, parentSuspense, isSVG);
        }
        else {
            const instance = (n2.component = n1.component);
            if (shouldUpdateComponent(n1, n2, optimized)) {
                if (
                    instance.asyncDep &&
                    !instance.asyncResolved) {
                    // async & still pending - just update props and slots
                    // since the component's reactive effect for render isn't set-up yet
                    {
                        pushWarningContext(n2);
                    }
                    updateComponentPreRender(instance, n2);
                    {
                        popWarningContext();
                    }
                    return;
                }
                else {
                    // normal update
                    instance.next = n2;
                    // instance.update is the reactive effect runner.
                    instance.update();
                }
            }
            else {
                // no update needed. just copy over properties
                n2.component = n1.component;
                n2.el = n1.el;
            }
        }
        if (n2.ref !== null && parentComponent !== null) {
            setRef(n2.ref, n1 && n1.ref, parentComponent, n2.component.renderProxy);
        }
    }
    function mountComponent(initialVNode, container, anchor, parentComponent, parentSuspense, isSVG) {
        const instance = (initialVNode.component = createComponentInstance(initialVNode, parentComponent));
        {
            pushWarningContext(initialVNode);
        }
        // resolve props and slots for setup context
        const propsOptions = initialVNode.type.props;
        resolveProps(instance, initialVNode.props, propsOptions);
        resolveSlots(instance, initialVNode.children);
        // setup stateful logic
        if (initialVNode.shapeFlag & 4 /* STATEFUL_COMPONENT */) {
            setupStatefulComponent(instance, parentSuspense);
        }
        // setup() is async. This component relies on async logic to be resolved
        // before proceeding
        if ( instance.asyncDep) {
            if (!parentSuspense) {
                // TODO handle this properly
                throw new Error('Async component without a suspense boundary!');
            }
            // parent suspense already resolved, need to re-suspense
            // use queueJob so it's handled synchronously after patching the current
            // suspense tree
            if (parentSuspense.isResolved) {
                queueJob(() => {
                    restartSuspense(parentSuspense);
                });
            }
            parentSuspense.deps++;
            instance.asyncDep
                .catch(err => {
                handleError(err, instance, 0 /* SETUP_FUNCTION */);
            })
                .then(asyncSetupResult => {
                // component may be unmounted before resolve
                if (!instance.isUnmounted && !parentSuspense.isUnmounted) {
                    retryAsyncComponent(instance, asyncSetupResult, parentSuspense, isSVG);
                }
            });
            // give it a placeholder
            const placeholder = (instance.subTree = createVNode(Comment));
            processCommentNode(null, placeholder, container, anchor);
            initialVNode.el = placeholder.el;
            return;
        }
        setupRenderEffect(instance, parentSuspense, initialVNode, container, anchor, isSVG);
        {
            popWarningContext();
        }
    }
    function retryAsyncComponent(instance, asyncSetupResult, parentSuspense, isSVG) {
        parentSuspense.deps--;
        // retry from this component
        instance.asyncResolved = true;
        const { vnode } = instance;
        {
            pushWarningContext(vnode);
        }
        handleSetupResult(instance, asyncSetupResult, parentSuspense);
        setupRenderEffect(instance, parentSuspense, vnode,
        // component may have been moved before resolve
        hostParentNode(instance.subTree.el), getNextHostNode(instance.subTree), isSVG);
        updateHOCHostEl(instance, vnode.el);
        {
            popWarningContext();
        }
        if (parentSuspense.deps === 0) {
            resolveSuspense(parentSuspense);
        }
    }
    function setupRenderEffect(instance, parentSuspense, initialVNode, container, anchor, isSVG) {
        // create reactive effect for rendering
        let mounted = false;
        instance.update = effect(function componentEffect() {
            if (!mounted) {
                const subTree = (instance.subTree = renderComponentRoot(instance));
                // beforeMount hook
                if (instance.bm !== null) {
                    invokeHooks(instance.bm);
                }
                patch(null, subTree, container, anchor, instance, parentSuspense, isSVG);
                initialVNode.el = subTree.el;
                // mounted hook
                if (instance.m !== null) {
                    queuePostRenderEffect(instance.m, parentSuspense);
                }
                mounted = true;
            }
            else {
                // updateComponent
                // This is triggered by mutation of component's own state (next: null)
                // OR parent calling processComponent (next: HostVNode)
                const { next } = instance;
                {
                    pushWarningContext(next || instance.vnode);
                }
                if (next !== null) {
                    updateComponentPreRender(instance, next);
                }
                const prevTree = instance.subTree;
                const nextTree = (instance.subTree = renderComponentRoot(instance));
                // beforeUpdate hook
                if (instance.bu !== null) {
                    invokeHooks(instance.bu);
                }
                // reset refs
                // only needed if previous patch had refs
                if (instance.refs !== EMPTY_OBJ) {
                    instance.refs = {};
                }
                patch(prevTree, nextTree,
                // parent may have changed if it's in a portal
                hostParentNode(prevTree.el),
                // anchor may have changed if it's in a fragment
                getNextHostNode(prevTree), instance, parentSuspense, isSVG);
                instance.vnode.el = nextTree.el;
                if (next === null) {
                    // self-triggered update. In case of HOC, update parent component
                    // vnode el. HOC is indicated by parent instance's subTree pointing
                    // to child component's vnode
                    updateHOCHostEl(instance, nextTree.el);
                }
                // updated hook
                if (instance.u !== null) {
                    queuePostRenderEffect(instance.u, parentSuspense);
                }
                {
                    popWarningContext();
                }
            }
        },  createDevEffectOptions(instance) );
    }
    function updateComponentPreRender(instance, nextVNode) {
        nextVNode.component = instance;
        instance.vnode = nextVNode;
        instance.next = null;
        resolveProps(instance, nextVNode.props, nextVNode.type.props);
        resolveSlots(instance, nextVNode.children);
    }
    function updateHOCHostEl({ vnode, parent }, el) {
        while (parent && parent.subTree === vnode) {
            (vnode = parent.vnode).el = el;
            parent = parent.parent;
        }
    }
    function patchChildren(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized = false) {
        const c1 = n1 && n1.children;
        const prevShapeFlag = n1 ? n1.shapeFlag : 0;
        const c2 = n2.children;
        const { patchFlag, shapeFlag } = n2;
        if (patchFlag === -1 /* BAIL */) {
            optimized = false;
        }
        // fast path
        if (patchFlag > 0) {
            if (patchFlag & 64 /* KEYED_FRAGMENT */) {
                // this could be either fully-keyed or mixed (some keyed some not)
                // presence of patchFlag means children are guaranteed to be arrays
                patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                return;
            }
            else if (patchFlag & 128 /* UNKEYED_FRAGMENT */) {
                // unkeyed
                patchUnkeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                return;
            }
        }
        // children has 3 possibilities: text, array or no children.
        if (shapeFlag & 8 /* TEXT_CHILDREN */) {
            // text children fast path
            if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                unmountChildren(c1, parentComponent, parentSuspense);
            }
            if (c2 !== c1) {
                hostSetElementText(container, c2);
            }
        }
        else {
            if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                // prev children was array
                if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    // two arrays, cannot assume anything, do full diff
                    patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                }
                else {
                    // no new children, just unmount old
                    unmountChildren(c1, parentComponent, parentSuspense, true);
                }
            }
            else {
                // prev children was text OR null
                // new children is array OR null
                if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
                    hostSetElementText(container, '');
                }
                // mount new if array
                if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    mountChildren(c2, container, anchor, parentComponent, parentSuspense, isSVG);
                }
            }
        }
    }
    function patchUnkeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        c1 = c1 || EMPTY_ARR;
        c2 = c2 || EMPTY_ARR;
        const oldLength = c1.length;
        const newLength = c2.length;
        const commonLength = Math.min(oldLength, newLength);
        let i;
        for (i = 0; i < commonLength; i++) {
            const nextChild = (c2[i] = normalizeVNode(c2[i]));
            patch(c1[i], nextChild, container, null, parentComponent, parentSuspense, isSVG, optimized);
        }
        if (oldLength > newLength) {
            // remove old
            unmountChildren(c1, parentComponent, parentSuspense, true, commonLength);
        }
        else {
            // mount new
            mountChildren(c2, container, anchor, parentComponent, parentSuspense, isSVG, commonLength);
        }
    }
    // can be all-keyed or mixed
    function patchKeyedChildren(c1, c2, container, parentAnchor, parentComponent, parentSuspense, isSVG, optimized) {
        let i = 0;
        const l2 = c2.length;
        let e1 = c1.length - 1; // prev ending index
        let e2 = l2 - 1; // next ending index
        // 1. sync from start
        // (a b) c
        // (a b) d e
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = (c2[i] = normalizeVNode(c2[i]));
            if (isSameType$1(n1, n2)) {
                patch(n1, n2, container, parentAnchor, parentComponent, parentSuspense, isSVG, optimized);
            }
            else {
                break;
            }
            i++;
        }
        // 2. sync from end
        // a (b c)
        // d e (b c)
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = (c2[e2] = normalizeVNode(c2[e2]));
            if (isSameType$1(n1, n2)) {
                patch(n1, n2, container, parentAnchor, parentComponent, parentSuspense, isSVG, optimized);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        // 3. common sequence + mount
        // (a b)
        // (a b) c
        // i = 2, e1 = 1, e2 = 2
        // (a b)
        // c (a b)
        // i = 0, e1 = -1, e2 = 0
        if (i > e1) {
            if (i <= e2) {
                const nextPos = e2 + 1;
                const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
                while (i <= e2) {
                    patch(null, (c2[i] = normalizeVNode(c2[i])), container, anchor, parentComponent, parentSuspense, isSVG);
                    i++;
                }
            }
        }
        // 4. common sequence + unmount
        // (a b) c
        // (a b)
        // i = 2, e1 = 2, e2 = 1
        // a (b c)
        // (b c)
        // i = 0, e1 = 0, e2 = -1
        else if (i > e2) {
            while (i <= e1) {
                unmount(c1[i], parentComponent, parentSuspense, true);
                i++;
            }
        }
        // 5. unknown sequence
        // [i ... e1 + 1]: a b [c d e] f g
        // [i ... e2 + 1]: a b [e d c h] f g
        // i = 2, e1 = 4, e2 = 5
        else {
            const s1 = i; // prev starting index
            const s2 = i; // next starting index
            // 5.1 build key:index map for newChildren
            const keyToNewIndexMap = new Map();
            for (i = s2; i <= e2; i++) {
                const nextChild = (c2[i] = normalizeVNode(c2[i]));
                if (nextChild.key != null) {
                    if ( keyToNewIndexMap.has(nextChild.key)) {
                        warn(`Duplicate keys found during update:`, JSON.stringify(nextChild.key), `Make sure keys are unique.`);
                    }
                    keyToNewIndexMap.set(nextChild.key, i);
                }
            }
            // 5.2 loop through old children left to be patched and try to patch
            // matching nodes & remove nodes that are no longer present
            let j;
            let patched = 0;
            const toBePatched = e2 - s2 + 1;
            let moved = false;
            // used to track whether any node has moved
            let maxNewIndexSoFar = 0;
            // works as Map<newIndex, oldIndex>
            // Note that oldIndex is offset by +1
            // and oldIndex = 0 is a special value indicating the new node has
            // no corresponding old node.
            // used for determining longest stable subsequence
            const newIndexToOldIndexMap = [];
            for (i = 0; i < toBePatched; i++)
                newIndexToOldIndexMap.push(0);
            for (i = s1; i <= e1; i++) {
                const prevChild = c1[i];
                if (patched >= toBePatched) {
                    // all new children have been patched so this can only be a removal
                    unmount(prevChild, parentComponent, parentSuspense, true);
                    continue;
                }
                let newIndex;
                if (prevChild.key != null) {
                    newIndex = keyToNewIndexMap.get(prevChild.key);
                }
                else {
                    // key-less node, try to locate a key-less node of the same type
                    for (j = s2; j <= e2; j++) {
                        if (newIndexToOldIndexMap[j - s2] === 0 &&
                            isSameType$1(prevChild, c2[j])) {
                            newIndex = j;
                            break;
                        }
                    }
                }
                if (newIndex === undefined) {
                    unmount(prevChild, parentComponent, parentSuspense, true);
                }
                else {
                    newIndexToOldIndexMap[newIndex - s2] = i + 1;
                    if (newIndex >= maxNewIndexSoFar) {
                        maxNewIndexSoFar = newIndex;
                    }
                    else {
                        moved = true;
                    }
                    patch(prevChild, c2[newIndex], container, null, parentComponent, parentSuspense, isSVG, optimized);
                    patched++;
                }
            }
            // 5.3 move and mount
            // generate longest stable subsequence only when nodes have moved
            const increasingNewIndexSequence = moved
                ? getSequence(newIndexToOldIndexMap)
                : EMPTY_ARR;
            j = increasingNewIndexSequence.length - 1;
            // looping backwards so that we can use last patched node as anchor
            for (i = toBePatched - 1; i >= 0; i--) {
                const nextIndex = s2 + i;
                const nextChild = c2[nextIndex];
                const anchor = nextIndex + 1 < l2
                    ? c2[nextIndex + 1].el
                    : parentAnchor;
                if (newIndexToOldIndexMap[i] === 0) {
                    // mount new
                    patch(null, nextChild, container, anchor, parentComponent, parentSuspense, isSVG);
                }
                else if (moved) {
                    // move if:
                    // There is no stable subsequence (e.g. a reverse)
                    // OR current node is not among the stable sequence
                    if (j < 0 || i !== increasingNewIndexSequence[j]) {
                        move(nextChild, container, anchor);
                    }
                    else {
                        j--;
                    }
                }
            }
        }
    }
    function move(vnode, container, anchor) {
        if (vnode.component !== null) {
            move(vnode.component.subTree, container, anchor);
            return;
        }
        if ( vnode.type === Suspense) {
            const suspense = vnode.suspense;
            move(suspense.isResolved ? suspense.subTree : suspense.fallbackTree, container, anchor);
            suspense.container = container;
            return;
        }
        if (vnode.type === Fragment) {
            hostInsert(vnode.el, container, anchor);
            const children = vnode.children;
            for (let i = 0; i < children.length; i++) {
                move(children[i], container, anchor);
            }
            hostInsert(vnode.anchor, container, anchor);
        }
        else {
            hostInsert(vnode.el, container, anchor);
        }
    }
    function unmount(vnode, parentComponent, parentSuspense, doRemove) {
        const { props, ref, type, component, suspense, children, dynamicChildren, shapeFlag, anchor } = vnode;
        // unset ref
        if (ref !== null && parentComponent !== null) {
            setRef(ref, null, parentComponent, null);
        }
        if (component != null) {
            unmountComponent(component, parentSuspense, doRemove);
            return;
        }
        if ( suspense != null) {
            unmountSuspense(suspense, parentComponent, parentSuspense, doRemove);
            return;
        }
        if (props != null && props.vnodeBeforeUnmount != null) {
            invokeDirectiveHook(props.vnodeBeforeUnmount, parentComponent, vnode);
        }
        const shouldRemoveChildren = type === Fragment && doRemove;
        if (dynamicChildren != null) {
            unmountChildren(dynamicChildren, parentComponent, parentSuspense, shouldRemoveChildren);
        }
        else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
            unmountChildren(children, parentComponent, parentSuspense, shouldRemoveChildren);
        }
        if (doRemove) {
            hostRemove(vnode.el);
            if (anchor != null)
                hostRemove(anchor);
        }
        if (props != null && props.vnodeUnmounted != null) {
            queuePostRenderEffect(() => {
                invokeDirectiveHook(props.vnodeUnmounted, parentComponent, vnode);
            }, parentSuspense);
        }
    }
    function unmountComponent(instance, parentSuspense, doRemove) {
        const { bum, effects, update, subTree, um } = instance;
        // beforeUnmount hook
        if (bum !== null) {
            invokeHooks(bum);
        }
        if (effects !== null) {
            for (let i = 0; i < effects.length; i++) {
                stop(effects[i]);
            }
        }
        // update may be null if a component is unmounted before its async
        // setup has resolved.
        if (update !== null) {
            stop(update);
            unmount(subTree, instance, parentSuspense, doRemove);
        }
        // unmounted hook
        if (um !== null) {
            queuePostRenderEffect(um, parentSuspense);
        }
        queuePostFlushCb(() => {
            instance.isUnmounted = true;
        });
        // A component with async dep inside a pending suspense is unmounted before
        // its async dep resolves. This should remove the dep from the suspense, and
        // cause the suspense to resolve immediately if that was the last dep.
        if (
            parentSuspense !== null &&
            !parentSuspense.isResolved &&
            !parentSuspense.isUnmounted &&
            instance.asyncDep !== null &&
            !instance.asyncResolved) {
            parentSuspense.deps--;
            if (parentSuspense.deps === 0) {
                resolveSuspense(parentSuspense);
            }
        }
    }
    function unmountSuspense(suspense, parentComponent, parentSuspense, doRemove) {
        suspense.isUnmounted = true;
        unmount(suspense.subTree, parentComponent, parentSuspense, doRemove);
        if (!suspense.isResolved) {
            unmount(suspense.fallbackTree, parentComponent, parentSuspense, doRemove);
        }
    }
    function unmountChildren(children, parentComponent, parentSuspense, doRemove, start = 0) {
        for (let i = start; i < children.length; i++) {
            unmount(children[i], parentComponent, parentSuspense, doRemove);
        }
    }
    function getNextHostNode({ component, suspense, anchor, el }) {
        if (component !== null) {
            return getNextHostNode(component.subTree);
        }
        if ( suspense !== null) {
            return getNextHostNode(suspense.isResolved ? suspense.subTree : suspense.fallbackTree);
        }
        return hostNextSibling((anchor || el));
    }
    function setRef(ref, oldRef, parent, value) {
        const refs = parent.refs === EMPTY_OBJ ? (parent.refs = {}) : parent.refs;
        const renderContext = toRaw(parent.renderContext);
        // unset old ref
        if (oldRef !== null && oldRef !== ref) {
            if (isString(oldRef)) {
                refs[oldRef] = null;
                const oldSetupRef = renderContext[oldRef];
                if (isRef(oldSetupRef)) {
                    oldSetupRef.value = null;
                }
            }
            else if (isRef(oldRef)) {
                oldRef.value = null;
            }
        }
        if (isString(ref)) {
            const setupRef = renderContext[ref];
            if (isRef(setupRef)) {
                setupRef.value = value;
            }
            refs[ref] = value;
        }
        else if (isRef(ref)) {
            ref.value = value;
        }
        else if (isFunction(ref)) {
            ref(value, refs);
        }
        else {
            warn('Invalid template ref type:', value, `(${typeof value})`);
        }
    }
    function render(vnode, rawContainer) {
        let container = rawContainer;
        if (isString(container)) {
            container = hostQuerySelector(container);
            if (!container) {
                {
                    warn(`Failed to locate root container: ` + `querySelector returned null.`);
                }
                return;
            }
        }
        if (vnode == null) {
            if (container._vnode) {
                unmount(container._vnode, null, null, true);
            }
        }
        else {
            patch(container._vnode || null, vnode, container);
        }
        flushPostFlushCbs();
        container._vnode = vnode;
    }
    return {
        render,
        createApp: createAppAPI(render)
    };
}
// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
function getSequence(arr) {
    const p = arr.slice();
    const result = [0];
    let i, j, u, v, c;
    const len = arr.length;
    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== 0) {
            j = result[result.length - 1];
            if (arr[j] < arrI) {
                p[i] = j;
                result.push(i);
                continue;
            }
            u = 0;
            v = result.length - 1;
            while (u < v) {
                c = ((u + v) / 2) | 0;
                if (arr[result[c]] < arrI) {
                    u = c + 1;
                }
                else {
                    v = c;
                }
            }
            if (arrI < arr[result[u]]) {
                if (u > 0) {
                    p[i] = result[u - 1];
                }
                result[u] = i;
            }
        }
    }
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
}

const invoke = (fn) => fn();
// implementation
function watch(effectOrSource, effectOrOptions, options) {
    if (isFunction(effectOrOptions)) {
        // effect callback as 2nd argument - this is a source watcher
        return doWatch(effectOrSource, effectOrOptions, options);
    }
    else {
        // 2nd argument is either missing or an options object
        // - this is a simple effect watcher
        return doWatch(effectOrSource, null, effectOrOptions);
    }
}
function doWatch(source, cb, { lazy, deep, flush, onTrack, onTrigger } = EMPTY_OBJ) {
    const instance = currentInstance;
    const suspense = currentSuspense;
    let getter;
    if (isArray(source)) {
        getter = () => source.map(s => isRef(s)
            ? s.value
            : callWithErrorHandling(s, instance, 2 /* WATCH_GETTER */));
    }
    else if (isRef(source)) {
        getter = () => source.value;
    }
    else if (cb) {
        // getter with cb
        getter = () => callWithErrorHandling(source, instance, 2 /* WATCH_GETTER */);
    }
    else {
        // no cb -> simple effect
        getter = () => {
            if (instance && instance.isUnmounted) {
                return;
            }
            if (cleanup) {
                cleanup();
            }
            return callWithErrorHandling(source, instance, 3 /* WATCH_CALLBACK */, [registerCleanup]);
        };
    }
    if (deep) {
        const baseGetter = getter;
        getter = () => traverse(baseGetter());
    }
    let cleanup;
    const registerCleanup = (fn) => {
        // TODO wrap the cleanup fn for error handling
        cleanup = runner.onStop = () => {
            callWithErrorHandling(fn, instance, 4 /* WATCH_CLEANUP */);
        };
    };
    let oldValue = isArray(source) ? [] : undefined;
    const applyCb = cb
        ? () => {
            if (instance && instance.isUnmounted) {
                return;
            }
            const newValue = runner();
            if (deep || newValue !== oldValue) {
                // cleanup before running cb again
                if (cleanup) {
                    cleanup();
                }
                callWithAsyncErrorHandling(cb, instance, 3 /* WATCH_CALLBACK */, [
                    newValue,
                    oldValue,
                    registerCleanup
                ]);
                oldValue = newValue;
            }
        }
        : void 0;
    let scheduler;
    if (flush === 'sync') {
        scheduler = invoke;
    }
    else if (flush === 'pre') {
        scheduler = job => {
            if (!instance || instance.vnode.el != null) {
                queueJob(job);
            }
            else {
                // with 'pre' option, the first call must happen before
                // the component is mounted so it is called synchronously.
                job();
            }
        };
    }
    else {
        scheduler = job => {
            queuePostRenderEffect(job, suspense);
        };
    }
    const runner = effect(getter, {
        lazy: true,
        // so it runs before component update effects in pre flush mode
        computed: true,
        onTrack,
        onTrigger,
        scheduler: applyCb ? () => scheduler(applyCb) : scheduler
    });
    if (!lazy) {
        if (applyCb) {
            scheduler(applyCb);
        }
        else {
            scheduler(runner);
        }
    }
    else {
        oldValue = runner();
    }
    recordEffect(runner);
    return () => {
        stop(runner);
    };
}
// this.$watch
function instanceWatch(source, cb, options) {
    const ctx = this.renderProxy;
    const getter = isString(source) ? () => ctx[source] : source.bind(ctx);
    const stop = watch(getter, cb.bind(ctx), options);
    onBeforeUnmount(stop, this);
    return stop;
}
function traverse(value, seen = new Set()) {
    if (!isObject(value) || seen.has(value)) {
        return;
    }
    seen.add(value);
    if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            traverse(value[i], seen);
        }
    }
    else if (value instanceof Map) {
        value.forEach((v, key) => {
            // to register mutation dep for existing keys
            traverse(value.get(key), seen);
        });
    }
    else if (value instanceof Set) {
        value.forEach(v => {
            traverse(v, seen);
        });
    }
    else {
        for (const key in value) {
            traverse(value[key], seen);
        }
    }
    return value;
}

const PublicInstanceProxyHandlers = {
    get(target, key) {
        const { renderContext, data, props, propsProxy } = target;
        if (data !== EMPTY_OBJ && hasOwn(data, key)) {
            return data[key];
        }
        else if (hasOwn(renderContext, key)) {
            return renderContext[key];
        }
        else if (hasOwn(props, key)) {
            // return the value from propsProxy for ref unwrapping and readonly
            return propsProxy[key];
        }
        else {
            // TODO simplify this?
            switch (key) {
                case '$data':
                    return data;
                case '$props':
                    return propsProxy;
                case '$attrs':
                    return target.attrs;
                case '$slots':
                    return target.slots;
                case '$refs':
                    return target.refs;
                case '$parent':
                    return target.parent;
                case '$root':
                    return target.root;
                case '$emit':
                    return target.emit;
                case '$el':
                    return target.vnode.el;
                case '$options':
                    return target.type;
                default:
                    // methods are only exposed when options are supported
                    {
                        switch (key) {
                            case '$forceUpdate':
                                return target.update;
                            case '$nextTick':
                                return nextTick;
                            case '$watch':
                                return instanceWatch.bind(target);
                        }
                    }
                    return target.user[key];
            }
        }
    },
    // this trap is only called in browser-compiled render functions that use
    // `with (this) {}`
    has(_, key) {
        return key[0] !== '_' && !globalsWhitelist.has(key);
    },
    set(target, key, value) {
        const { data, renderContext } = target;
        if (data !== EMPTY_OBJ && hasOwn(data, key)) {
            data[key] = value;
        }
        else if (hasOwn(renderContext, key)) {
            renderContext[key] = value;
        }
        else if (key[0] === '$' && key.slice(1) in target) {
            // TODO warn attempt of mutating public property
            return false;
        }
        else if (key in target.props) {
            // TODO warn attempt of mutating prop
            return false;
        }
        else {
            target.user[key] = value;
        }
        return true;
    }
};

function provide(key, value) {
    if (!currentInstance) {
        {
            warn(`provide() can only be used inside setup().`);
        }
    }
    else {
        let provides = currentInstance.provides;
        // by default an instance inherits its parent's provides object
        // but when it needs to provide values of its own, it creates its
        // own provides object using parent provides object as prototype.
        // this way in `inject` we can simply look up injections from direct
        // parent and let the prototype chain do the work.
        const parentProvides = currentInstance.parent && currentInstance.parent.provides;
        if (parentProvides === provides) {
            provides = currentInstance.provides = Object.create(parentProvides);
        }
        provides[key] = value;
    }
}
function inject(key, defaultValue) {
    if (currentInstance) {
        const provides = currentInstance.provides;
        if (key in provides) {
            return provides[key];
        }
        else if (defaultValue !== undefined) {
            return defaultValue;
        }
        else {
            warn(`injection "${key}" not found.`);
        }
    }
    else {
        warn(`inject() can only be used inside setup().`);
    }
}

function applyOptions(instance, options, asMixin = false) {
    const renderContext = instance.renderContext === EMPTY_OBJ
        ? (instance.renderContext = reactive({}))
        : instance.renderContext;
    const ctx = instance.renderProxy;
    const {
    // composition
    mixins, extends: extendsOptions,
    // state
    data: dataOptions, computed: computedOptions, methods, watch: watchOptions, provide: provideOptions, inject: injectOptions,
    // assets
    components, directives,
    // lifecycle
    beforeMount, mounted, beforeUpdate, updated,
    // TODO activated
    // TODO deactivated
    beforeUnmount, unmounted, renderTracked, renderTriggered, errorCaptured } = options;
    const globalMixins = instance.appContext.mixins;
    // applyOptions is called non-as-mixin once per instance
    if (!asMixin) {
        callSyncHook('beforeCreate', options, ctx, globalMixins);
        // global mixins are applied first
        applyMixins(instance, globalMixins);
    }
    // extending a base component...
    if (extendsOptions) {
        applyOptions(instance, extendsOptions, true);
    }
    // local mixins
    if (mixins) {
        applyMixins(instance, mixins);
    }
    // state options
    if (dataOptions) {
        const data = isFunction(dataOptions) ? dataOptions.call(ctx) : dataOptions;
        if (!isObject(data)) {
             warn(`data() should return an object.`);
        }
        else if (instance.data === EMPTY_OBJ) {
            instance.data = reactive(data);
        }
        else {
            // existing data: this is a mixin or extends.
            extend(instance.data, data);
        }
    }
    if (computedOptions) {
        for (const key in computedOptions) {
            const opt = computedOptions[key];
            renderContext[key] = isFunction(opt)
                ? computed$1(opt.bind(ctx))
                : computed$1({
                    get: opt.get.bind(ctx),
                    set: opt.set.bind(ctx)
                });
        }
    }
    if (methods) {
        for (const key in methods) {
            renderContext[key] = methods[key].bind(ctx);
        }
    }
    if (watchOptions) {
        for (const key in watchOptions) {
            const raw = watchOptions[key];
            const getter = () => ctx[key];
            if (isString(raw)) {
                const handler = renderContext[raw];
                if (isFunction(handler)) {
                    watch(getter, handler);
                }
            }
            else if (isFunction(raw)) {
                watch(getter, raw.bind(ctx));
            }
            else if (isObject(raw)) {
                // TODO 2.x compat
                watch(getter, raw.handler.bind(ctx), raw);
            }
        }
    }
    if (provideOptions) {
        const provides = isFunction(provideOptions)
            ? provideOptions.call(ctx)
            : provideOptions;
        for (const key in provides) {
            provide(key, provides[key]);
        }
    }
    if (injectOptions) {
        if (isArray(injectOptions)) {
            for (let i = 0; i < injectOptions.length; i++) {
                const key = injectOptions[i];
                renderContext[key] = inject(key);
            }
        }
        else {
            for (const key in injectOptions) {
                const opt = injectOptions[key];
                if (isObject(opt)) {
                    renderContext[key] = inject(opt.from, opt.default);
                }
                else {
                    renderContext[key] = inject(opt);
                }
            }
        }
    }
    // asset options
    if (components) {
        extend(instance.components, components);
    }
    if (directives) {
        extend(instance.directives, directives);
    }
    // lifecycle options
    if (!asMixin) {
        callSyncHook('created', options, ctx, globalMixins);
    }
    if (beforeMount) {
        onBeforeMount(beforeMount.bind(ctx));
    }
    if (mounted) {
        onMounted(mounted.bind(ctx));
    }
    if (beforeUpdate) {
        onBeforeUpdate(beforeUpdate.bind(ctx));
    }
    if (updated) {
        onUpdated(updated.bind(ctx));
    }
    if (errorCaptured) {
        onErrorCaptured(errorCaptured.bind(ctx));
    }
    if (renderTracked) {
        onRenderTracked(renderTracked.bind(ctx));
    }
    if (renderTriggered) {
        onRenderTriggered(renderTriggered.bind(ctx));
    }
    if (beforeUnmount) {
        onBeforeUnmount(beforeUnmount.bind(ctx));
    }
    if (unmounted) {
        onUnmounted(unmounted.bind(ctx));
    }
}
function callSyncHook(name, options, ctx, globalMixins) {
    callHookFromMixins(name, globalMixins, ctx);
    const baseHook = options.extends && options.extends[name];
    if (baseHook) {
        baseHook.call(ctx);
    }
    const mixins = options.mixins;
    if (mixins) {
        callHookFromMixins(name, mixins, ctx);
    }
    const selfHook = options[name];
    if (selfHook) {
        selfHook.call(ctx);
    }
}
function callHookFromMixins(name, mixins, ctx) {
    for (let i = 0; i < mixins.length; i++) {
        const fn = mixins[i][name];
        if (fn) {
            fn.call(ctx);
        }
    }
}
function applyMixins(instance, mixins) {
    for (let i = 0; i < mixins.length; i++) {
        applyOptions(instance, mixins[i], true);
    }
}

const emptyAppContext = createAppContext();
function createComponentInstance(vnode, parent) {
    // inherit parent app context - or - if root, adopt from root vnode
    const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
    const instance = {
        vnode,
        parent,
        appContext,
        type: vnode.type,
        root: null,
        next: null,
        subTree: null,
        update: null,
        render: null,
        renderProxy: null,
        propsProxy: null,
        setupContext: null,
        effects: null,
        provides: parent ? parent.provides : Object.create(appContext.provides),
        // setup context properties
        renderContext: EMPTY_OBJ,
        data: EMPTY_OBJ,
        props: EMPTY_OBJ,
        attrs: EMPTY_OBJ,
        slots: EMPTY_OBJ,
        refs: EMPTY_OBJ,
        // per-instance asset storage (mutable during options resolution)
        components: Object.create(appContext.components),
        directives: Object.create(appContext.directives),
        // async dependency management
        asyncDep: null,
        asyncResult: null,
        asyncResolved: false,
        // user namespace for storing whatever the user assigns to `this`
        user: {},
        // lifecycle hooks
        // not using enums here because it results in computed properties
        isUnmounted: false,
        bc: null,
        c: null,
        bm: null,
        m: null,
        bu: null,
        u: null,
        um: null,
        bum: null,
        da: null,
        a: null,
        rtg: null,
        rtc: null,
        ec: null,
        emit: (event, ...args) => {
            const props = instance.vnode.props || EMPTY_OBJ;
            const handler = props[`on${event}`] || props[`on${capitalize(event)}`];
            if (handler) {
                if (isArray(handler)) {
                    for (let i = 0; i < handler.length; i++) {
                        callWithAsyncErrorHandling(handler[i], instance, 6 /* COMPONENT_EVENT_HANDLER */, args);
                    }
                }
                else {
                    callWithAsyncErrorHandling(handler, instance, 6 /* COMPONENT_EVENT_HANDLER */, args);
                }
            }
        }
    };
    instance.root = parent ? parent.root : instance;
    return instance;
}
let currentInstance = null;
let currentSuspense = null;
const getCurrentInstance = () => currentInstance;
const setCurrentInstance = (instance) => {
    currentInstance = instance;
};
function setupStatefulComponent(instance, parentSuspense) {
    const Component = instance.type;
    // 1. create render proxy
    instance.renderProxy = new Proxy(instance, PublicInstanceProxyHandlers);
    // 2. create props proxy
    // the propsProxy is a reactive AND readonly proxy to the actual props.
    // it will be updated in resolveProps() on updates before render
    const propsProxy = (instance.propsProxy = readonly(instance.props));
    // 3. call setup()
    const { setup } = Component;
    if (setup) {
        const setupContext = (instance.setupContext =
            setup.length > 1 ? createSetupContext(instance) : null);
        currentInstance = instance;
        currentSuspense = parentSuspense;
        const setupResult = callWithErrorHandling(setup, instance, 0 /* SETUP_FUNCTION */, [propsProxy, setupContext]);
        currentInstance = null;
        currentSuspense = null;
        if (setupResult &&
            isFunction(setupResult.then) &&
            isFunction(setupResult.catch)) {
            {
                // async setup returned Promise.
                // bail here and wait for re-entry.
                instance.asyncDep = setupResult;
            }
            return;
        }
        else {
            handleSetupResult(instance, setupResult, parentSuspense);
        }
    }
    else {
        finishComponentSetup(instance, parentSuspense);
    }
}
function handleSetupResult(instance, setupResult, parentSuspense) {
    if (isFunction(setupResult)) {
        // setup returned an inline render function
        instance.render = setupResult;
    }
    else if (isObject(setupResult)) {
        if ( isVNode(setupResult)) {
            warn(`setup() should not return VNodes directly - ` +
                `return a render function instead.`);
        }
        // setup returned bindings.
        // assuming a render function compiled from template is present.
        instance.renderContext = reactive(setupResult);
    }
    else if ( setupResult !== undefined) {
        warn(`setup() should return an object. Received: ${setupResult === null ? 'null' : typeof setupResult}`);
    }
    finishComponentSetup(instance, parentSuspense);
}
let compile;
function registerRuntimeCompiler(_compile) {
    compile = _compile;
}
function finishComponentSetup(instance, parentSuspense) {
    const Component = instance.type;
    if (!instance.render) {
        if (Component.template && !Component.render) {
            if (compile) {
                Component.render = compile(Component.template, {
                    onError(err) { }
                });
            }
            else {
                warn(`Component provides template but the build of Vue you are running ` +
                    `does not support on-the-fly template compilation. Either use the ` +
                    `full build or pre-compile the template using Vue CLI.`);
            }
        }
        if ( !Component.render) {
            warn(`Component is missing render function. Either provide a template or ` +
                `return a render function from setup().`);
        }
        instance.render = (Component.render || NOOP);
    }
    // support for 2.x options
    {
        currentInstance = instance;
        currentSuspense = parentSuspense;
        applyOptions(instance, Component);
        currentInstance = null;
        currentSuspense = null;
    }
    if (instance.renderContext === EMPTY_OBJ) {
        instance.renderContext = reactive({});
    }
}
// used to identify a setup context proxy
const SetupProxySymbol = Symbol();
const SetupProxyHandlers = {};
['attrs', 'slots', 'refs'].forEach((type) => {
    SetupProxyHandlers[type] = {
        get: (instance, key) => instance[type][key],
        has: (instance, key) => key === SetupProxySymbol || key in instance[type],
        ownKeys: instance => Reflect.ownKeys(instance[type]),
        // this is necessary for ownKeys to work properly
        getOwnPropertyDescriptor: (instance, key) => Reflect.getOwnPropertyDescriptor(instance[type], key),
        set: () => false,
        deleteProperty: () => false
    };
});
function createSetupContext(instance) {
    const context = {
        // attrs, slots & refs are non-reactive, but they need to always expose
        // the latest values (instance.xxx may get replaced during updates) so we
        // need to expose them through a proxy
        attrs: new Proxy(instance, SetupProxyHandlers.attrs),
        slots: new Proxy(instance, SetupProxyHandlers.slots),
        refs: new Proxy(instance, SetupProxyHandlers.refs),
        emit: instance.emit
    };
    return  Object.freeze(context) ;
}

// record effects created during a component's setup() so that they can be
// stopped when the component unmounts
function recordEffect(effect) {
    if (currentInstance) {
        (currentInstance.effects || (currentInstance.effects = [])).push(effect);
    }
}
function computed$1(getterOrOptions) {
    const c = computed(getterOrOptions);
    recordEffect(c.effect);
    return c;
}

// Actual implementation
function h(type, propsOrChildren, children) {
    if (arguments.length === 2) {
        if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
            // props without children
            return createVNode(type, propsOrChildren);
        }
        else {
            // omit props
            return createVNode(type, null, propsOrChildren);
        }
    }
    else {
        return createVNode(type, propsOrChildren, children);
    }
}

// but the flags are also exported as an actual object for external use
const PublicShapeFlags = {
    ELEMENT: 1 /* ELEMENT */,
    FUNCTIONAL_COMPONENT: 2 /* FUNCTIONAL_COMPONENT */,
    STATEFUL_COMPONENT: 4 /* STATEFUL_COMPONENT */,
    TEXT_CHILDREN: 8 /* TEXT_CHILDREN */,
    ARRAY_CHILDREN: 16 /* ARRAY_CHILDREN */,
    SLOTS_CHILDREN: 32 /* SLOTS_CHILDREN */,
    COMPONENT: 6 /* COMPONENT */
};

function resolveComponent(name) {
    return resolveAsset('components', name);
}
function resolveDirective(name) {
    return resolveAsset('directives', name);
}
function resolveAsset(type, name) {
    const instance = currentRenderingInstance || currentInstance;
    if (instance) {
        let camelized;
        const registry = instance[type];
        const res = registry[name] ||
            registry[(camelized = camelize(name))] ||
            registry[capitalize(camelized)];
        if ( !res) {
            warn(`Failed to resolve ${type.slice(0, -1)}: ${name}`);
        }
        return res;
    }
    else {
        warn(`resolve${capitalize(type.slice(0, -1))} ` +
            `can only be used in render() or setup().`);
    }
}

function renderList(source, renderItem) {
    let ret = [];
    if (isArray(source) || isString(source)) {
        for (let i = 0, l = source.length; i < l; i++) {
            ret.push(renderItem(source[i], i));
        }
    }
    else if (typeof source === 'number') {
        for (let i = 0; i < source; i++) {
            ret.push(renderItem(i + 1, i));
        }
    }
    else if (isObject(source)) {
        if (source[Symbol.iterator]) {
            ret = [];
            const iterator = source[Symbol.iterator]();
            let result = iterator.next();
            while (!result.done) {
                ret.push(renderItem(result.value, ret.length));
                result = iterator.next();
            }
        }
        else {
            const keys = Object.keys(source);
            ret = new Array(keys.length);
            for (let i = 0, l = keys.length; i < l; i++) {
                const key = keys[i];
                ret[i] = renderItem(source[key], key, i);
            }
        }
    }
    return ret;
}

// for converting {{ interpolation }} values to displayed strings.
function toString(val) {
    return val == null
        ? ''
        : isArray(val) || (isPlainObject(val) && val.toString === objectToString)
            ? JSON.stringify(val, null, 2)
            : String(val);
}

// For prefixing keys in v-on="obj" with "on"
function toHandlers(obj) {
    const ret = {};
    if ( !isObject(obj)) {
        warn(`v-on with no argument expects an object value.`);
        return ret;
    }
    for (const key in obj) {
        ret[`on${key}`] = obj[key];
    }
    return ret;
}

function renderSlot(slots, name, props = {},
// this is not a user-facing function, so the fallback is always generated by
// the compiler and guaranteed to be an array
fallback) {
    const slot = slots[name];
    return (openBlock(),
        createBlock(Fragment, { key: props.key }, slot ? slot(props) : fallback || [], slots._compiled ? 0 : -1 /* BAIL */));
}

function createSlots(slots, dynamicSlots) {
    for (let i = 0; i < dynamicSlots.length; i++) {
        const slot = dynamicSlots[i];
        // array of dynamic slot generated by <template v-for="..." #[...]>
        if (isArray(slot)) {
            for (let j = 0; j < slot.length; j++) {
                slots[slot[i].name] = slot[i].fn;
            }
        }
        else {
            // conditional single slot generated by <template v-if="..." #foo>
            slots[slot.name] = slot.fn;
        }
    }
    return slots;
}

const doc = document;
const svgNS = 'http://www.w3.org/2000/svg';
const nodeOps = {
    insert: (child, parent, anchor) => {
        if (anchor != null) {
            parent.insertBefore(child, anchor);
        }
        else {
            parent.appendChild(child);
        }
    },
    remove: (child) => {
        const parent = child.parentNode;
        if (parent != null) {
            parent.removeChild(child);
        }
    },
    createElement: (tag, isSVG) => isSVG ? doc.createElementNS(svgNS, tag) : doc.createElement(tag),
    createText: (text) => doc.createTextNode(text),
    createComment: (text) => doc.createComment(text),
    setText: (node, text) => {
        node.nodeValue = text;
    },
    setElementText: (el, text) => {
        el.textContent = text;
    },
    parentNode: (node) => node.parentNode,
    nextSibling: (node) => node.nextSibling,
    querySelector: (selector) => doc.querySelector(selector)
};

// compiler should normalize class + :class bindings on the same element
// into a single binding ['staticClass', dynamic]
function patchClass(el, value, isSVG) {
    // directly setting className should be faster than setAttribute in theory
    if (isSVG) {
        el.setAttribute('class', value);
    }
    else {
        el.className = value;
    }
}

function patchStyle(el, prev, next) {
    const { style } = el;
    if (!next) {
        el.removeAttribute('style');
    }
    else if (isString(next)) {
        style.cssText = next;
    }
    else {
        for (const key in next) {
            style[key] = next[key];
        }
        if (prev && !isString(prev)) {
            for (const key in prev) {
                if (!next[key]) {
                    style[key] = '';
                }
            }
        }
    }
}

const xlinkNS = 'http://www.w3.org/1999/xlink';
function isXlink(name) {
    return name.charAt(5) === ':' && name.slice(0, 5) === 'xlink';
}
function getXlinkProp(name) {
    return isXlink(name) ? name.slice(6, name.length) : '';
}
function patchAttr(el, key, value, isSVG) {
    // isSVG short-circuits isXlink check
    if (isSVG && isXlink(key)) {
        if (value == null) {
            el.removeAttributeNS(xlinkNS, getXlinkProp(key));
        }
        else {
            el.setAttributeNS(xlinkNS, key, value);
        }
    }
    else {
        if (value == null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, value);
        }
    }
}

function patchDOMProp(el, key, value,
// the following args are passed only due to potential innerHTML/textContent
// overriding existing VNodes, in which case the old tree must be properly
// unmounted.
prevChildren, parentComponent, parentSuspense, unmountChildren) {
    if ((key === 'innerHTML' || key === 'textContent') && prevChildren != null) {
        unmountChildren(prevChildren, parentComponent, parentSuspense);
    }
    el[key] = value == null ? '' : value;
}

// Async edge case fix requires storing an event listener's attach timestamp.
let _getNow = Date.now;
// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res ( relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
if (typeof document !== 'undefined' &&
    _getNow() > document.createEvent('Event').timeStamp) {
    // if the low-res timestamp which is bigger than the event timestamp
    // (which is evaluated AFTER) it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listeners as well.
    _getNow = () => performance.now();
}
// To avoid the overhead of repeatedly calling performance.now(), we cache
// and use the same timestamp for all event listeners attached in the same tick.
let cachedNow = 0;
const p$1 = Promise.resolve();
const reset = () => {
    cachedNow = 0;
};
const getNow = () => cachedNow || (p$1.then(reset), (cachedNow = _getNow()));
function patchEvent(el, name, prevValue, nextValue, instance = null) {
    const invoker = prevValue && prevValue.invoker;
    if (nextValue) {
        if (invoker) {
            prevValue.invoker = null;
            invoker.value = nextValue;
            nextValue.invoker = invoker;
            invoker.lastUpdated = getNow();
        }
        else {
            el.addEventListener(name, createInvoker(nextValue, instance));
        }
    }
    else if (invoker) {
        el.removeEventListener(name, invoker);
    }
}
function createInvoker(value, instance) {
    const invoker = ((e) => {
        // async edge case #6566: inner click event triggers patch, event handler
        // attached to outer element during patch, and triggered again. This
        // happens because browsers fire microtask ticks between event propagation.
        // the solution is simple: we save the timestamp when a handler is attached,
        // and the handler would only fire if the event passed to it was fired
        // AFTER it was attached.
        if (e.timeStamp >= invoker.lastUpdated) {
            const args = [e];
            if (isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    callWithAsyncErrorHandling(value[i], instance, 5 /* NATIVE_EVENT_HANDLER */, args);
                }
            }
            else {
                callWithAsyncErrorHandling(value, instance, 5 /* NATIVE_EVENT_HANDLER */, args);
            }
        }
    });
    invoker.value = value;
    value.invoker = invoker;
    invoker.lastUpdated = getNow();
    return invoker;
}

function patchProp(el, key, nextValue, prevValue, isSVG, prevChildren, parentComponent, parentSuspense, unmountChildren) {
    switch (key) {
        // special
        case 'class':
            patchClass(el, nextValue, isSVG);
            break;
        case 'style':
            patchStyle(el, prevValue, nextValue);
            break;
        default:
            if (isOn(key)) {
                patchEvent(el, key.slice(2).toLowerCase(), prevValue, nextValue, parentComponent);
            }
            else if (!isSVG && key in el) {
                patchDOMProp(el, key, nextValue, prevChildren, parentComponent, parentSuspense, unmountChildren);
            }
            else {
                patchAttr(el, key, nextValue, isSVG);
            }
            break;
    }
}

const { render, createApp } = createRenderer({
    patchProp,
    ...nodeOps
});

export { Comment, Fragment, PublicPatchFlags as PatchFlags, Portal, PublicShapeFlags as ShapeFlags, Suspense, Text, applyDirectives, callWithAsyncErrorHandling, callWithErrorHandling, camelize, capitalize, cloneVNode, computed$1 as computed, createApp, createBlock, createComponent, createRenderer, createSlots, createVNode, effect, getCurrentInstance, h, handleError, inject, instanceWatch, isReactive, isReadonly, isRef, markNonReactive, markReadonly, mergeProps, nextTick, onBeforeMount, onBeforeUnmount, onBeforeUpdate, onErrorCaptured, onMounted, onRenderTracked, onRenderTriggered, onUnmounted, onUpdated, openBlock, provide, reactive, readonly, recordEffect, ref, registerRuntimeCompiler, render, renderList, renderSlot, resolveComponent, resolveDirective, toHandlers, toRaw, toRefs, toString, watch };
