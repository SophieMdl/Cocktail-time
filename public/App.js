'use strict';

function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function get_store_value(store) {
    let value;
    subscribe(store, _ => value = _)();
    return value;
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error(`Function called outside component initialization`);
    return current_component;
}
function beforeUpdate(fn) {
    get_current_component().$$.before_update.push(fn);
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
}
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}
function setContext(key, context) {
    get_current_component().$$.context.set(key, context);
}
function getContext(key) {
    return get_current_component().$$.context.get(key);
}

// source: https://html.spec.whatwg.org/multipage/indices.html
const boolean_attributes = new Set([
    'allowfullscreen',
    'allowpaymentrequest',
    'async',
    'autofocus',
    'autoplay',
    'checked',
    'controls',
    'default',
    'defer',
    'disabled',
    'formnovalidate',
    'hidden',
    'ismap',
    'loop',
    'multiple',
    'muted',
    'nomodule',
    'novalidate',
    'open',
    'playsinline',
    'readonly',
    'required',
    'reversed',
    'selected'
]);

const invalid_attribute_name_character = /[\s'">/=\u{FDD0}-\u{FDEF}\u{FFFE}\u{FFFF}\u{1FFFE}\u{1FFFF}\u{2FFFE}\u{2FFFF}\u{3FFFE}\u{3FFFF}\u{4FFFE}\u{4FFFF}\u{5FFFE}\u{5FFFF}\u{6FFFE}\u{6FFFF}\u{7FFFE}\u{7FFFF}\u{8FFFE}\u{8FFFF}\u{9FFFE}\u{9FFFF}\u{AFFFE}\u{AFFFF}\u{BFFFE}\u{BFFFF}\u{CFFFE}\u{CFFFF}\u{DFFFE}\u{DFFFF}\u{EFFFE}\u{EFFFF}\u{FFFFE}\u{FFFFF}\u{10FFFE}\u{10FFFF}]/u;
// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
// https://infra.spec.whatwg.org/#noncharacter
function spread(args, classes_to_add) {
    const attributes = Object.assign({}, ...args);
    if (classes_to_add) {
        if (attributes.class == null) {
            attributes.class = classes_to_add;
        }
        else {
            attributes.class += ' ' + classes_to_add;
        }
    }
    let str = '';
    Object.keys(attributes).forEach(name => {
        if (invalid_attribute_name_character.test(name))
            return;
        const value = attributes[name];
        if (value === true)
            str += " " + name;
        else if (boolean_attributes.has(name.toLowerCase())) {
            if (value)
                str += " " + name;
        }
        else if (value != null) {
            str += ` ${name}="${String(value).replace(/"/g, '&#34;').replace(/'/g, '&#39;')}"`;
        }
    });
    return str;
}
const escaped = {
    '"': '&quot;',
    "'": '&#39;',
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};
function escape(html) {
    return String(html).replace(/["'&<>]/g, match => escaped[match]);
}
function each(items, fn) {
    let str = '';
    for (let i = 0; i < items.length; i += 1) {
        str += fn(items[i], i);
    }
    return str;
}
const missing_component = {
    $$render: () => ''
};
function validate_component(component, name) {
    if (!component || !component.$$render) {
        if (name === 'svelte:component')
            name += ' this={...}';
        throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
    }
    return component;
}
let on_destroy;
function create_ssr_component(fn) {
    function $$render(result, props, bindings, slots) {
        const parent_component = current_component;
        const $$ = {
            on_destroy,
            context: new Map(parent_component ? parent_component.$$.context : []),
            // these will be immediately discarded
            on_mount: [],
            before_update: [],
            after_update: [],
            callbacks: blank_object()
        };
        set_current_component({ $$ });
        const html = fn(result, props, bindings, slots);
        set_current_component(parent_component);
        return html;
    }
    return {
        render: (props = {}, options = {}) => {
            on_destroy = [];
            const result = { title: '', head: '', css: new Set() };
            const html = $$render(result, props, {}, options);
            run_all(on_destroy);
            return {
                html,
                css: {
                    code: Array.from(result.css).map(css => css.code).join('\n'),
                    map: null // TODO
                },
                head: result.title + result.head
            };
        },
        $$render
    };
}
function add_attribute(name, value, boolean) {
    if (value == null || (boolean && !value))
        return '';
    return ` ${name}${value === true ? '' : `=${typeof value === 'string' ? JSON.stringify(escape(value)) : `"${value}"`}`}`;
}

const subscriber_queue = [];
/**
 * Creates a `Readable` store that allows reading by subscription.
 * @param value initial value
 * @param {StartStopNotifier}start start and stop notifications for subscriptions
 */
function readable(value, start) {
    return {
        subscribe: writable(value, start).subscribe,
    };
}
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = [];
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (let i = 0; i < subscribers.length; i += 1) {
                    const s = subscribers[i];
                    s[1]();
                    subscriber_queue.push(s, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.push(subscriber);
        if (subscribers.length === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            const index = subscribers.indexOf(subscriber);
            if (index !== -1) {
                subscribers.splice(index, 1);
            }
            if (subscribers.length === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}
function derived(stores, fn, initial_value) {
    const single = !Array.isArray(stores);
    const stores_array = single
        ? [stores]
        : stores;
    const auto = fn.length < 2;
    return readable(initial_value, (set) => {
        let inited = false;
        const values = [];
        let pending = 0;
        let cleanup = noop;
        const sync = () => {
            if (pending) {
                return;
            }
            cleanup();
            const result = fn(single ? values[0] : values, set);
            if (auto) {
                set(result);
            }
            else {
                cleanup = is_function(result) ? result : noop;
            }
        };
        const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
            values[i] = value;
            pending &= ~(1 << i);
            if (inited) {
                sync();
            }
        }, () => {
            pending |= (1 << i);
        }));
        inited = true;
        sync();
        return function stop() {
            run_all(unsubscribers);
            cleanup();
        };
    });
}

const LOCATION = {};
const ROUTER = {};

/**
 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
 *
 * https://github.com/reach/router/blob/master/LICENSE
 * */

function getLocation(source) {
  return {
    ...source.location,
    state: source.history.state,
    key: (source.history.state && source.history.state.key) || "initial"
  };
}

function createHistory(source, options) {
  const listeners = [];
  let location = getLocation(source);

  return {
    get location() {
      return location;
    },

    listen(listener) {
      listeners.push(listener);

      const popstateListener = () => {
        location = getLocation(source);
        listener({ location, action: "POP" });
      };

      source.addEventListener("popstate", popstateListener);

      return () => {
        source.removeEventListener("popstate", popstateListener);

        const index = listeners.indexOf(listener);
        listeners.splice(index, 1);
      };
    },

    navigate(to, { state, replace = false } = {}) {
      state = { ...state, key: Date.now() + "" };
      // try...catch iOS Safari limits to 100 pushState calls
      try {
        if (replace) {
          source.history.replaceState(state, null, to);
        } else {
          source.history.pushState(state, null, to);
        }
      } catch (e) {
        source.location[replace ? "replace" : "assign"](to);
      }

      location = getLocation(source);
      listeners.forEach(listener => listener({ location, action: "PUSH" }));
    }
  };
}

// Stores history entries in memory for testing or other platforms like Native
function createMemorySource(initialPathname = "/") {
  let index = 0;
  const stack = [{ pathname: initialPathname, search: "" }];
  const states = [];

  return {
    get location() {
      return stack[index];
    },
    addEventListener(name, fn) {},
    removeEventListener(name, fn) {},
    history: {
      get entries() {
        return stack;
      },
      get index() {
        return index;
      },
      get state() {
        return states[index];
      },
      pushState(state, _, uri) {
        const [pathname, search = ""] = uri.split("?");
        index++;
        stack.push({ pathname, search });
        states.push(state);
      },
      replaceState(state, _, uri) {
        const [pathname, search = ""] = uri.split("?");
        stack[index] = { pathname, search };
        states[index] = state;
      }
    }
  };
}

// Global history uses window.history as the source if available,
// otherwise a memory history
const canUseDOM = Boolean(
  typeof window !== "undefined" &&
    window.document &&
    window.document.createElement
);
const globalHistory = createHistory(canUseDOM ? window : createMemorySource());

/**
 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
 *
 * https://github.com/reach/router/blob/master/LICENSE
 * */

const paramRe = /^:(.+)/;

const SEGMENT_POINTS = 4;
const STATIC_POINTS = 3;
const DYNAMIC_POINTS = 2;
const SPLAT_PENALTY = 1;
const ROOT_POINTS = 1;

/**
 * Check if `string` starts with `search`
 * @param {string} string
 * @param {string} search
 * @return {boolean}
 */
function startsWith(string, search) {
  return string.substr(0, search.length) === search;
}

/**
 * Check if `segment` is a root segment
 * @param {string} segment
 * @return {boolean}
 */
function isRootSegment(segment) {
  return segment === "";
}

/**
 * Check if `segment` is a dynamic segment
 * @param {string} segment
 * @return {boolean}
 */
function isDynamic(segment) {
  return paramRe.test(segment);
}

/**
 * Check if `segment` is a splat
 * @param {string} segment
 * @return {boolean}
 */
function isSplat(segment) {
  return segment[0] === "*";
}

/**
 * Split up the URI into segments delimited by `/`
 * @param {string} uri
 * @return {string[]}
 */
function segmentize(uri) {
  return (
    uri
      // Strip starting/ending `/`
      .replace(/(^\/+|\/+$)/g, "")
      .split("/")
  );
}

/**
 * Strip `str` of potential start and end `/`
 * @param {string} str
 * @return {string}
 */
function stripSlashes(str) {
  return str.replace(/(^\/+|\/+$)/g, "");
}

/**
 * Score a route depending on how its individual segments look
 * @param {object} route
 * @param {number} index
 * @return {object}
 */
function rankRoute(route, index) {
  const score = route.default
    ? 0
    : segmentize(route.path).reduce((score, segment) => {
        score += SEGMENT_POINTS;

        if (isRootSegment(segment)) {
          score += ROOT_POINTS;
        } else if (isDynamic(segment)) {
          score += DYNAMIC_POINTS;
        } else if (isSplat(segment)) {
          score -= SEGMENT_POINTS + SPLAT_PENALTY;
        } else {
          score += STATIC_POINTS;
        }

        return score;
      }, 0);

  return { route, score, index };
}

/**
 * Give a score to all routes and sort them on that
 * @param {object[]} routes
 * @return {object[]}
 */
function rankRoutes(routes) {
  return (
    routes
      .map(rankRoute)
      // If two routes have the exact same score, we go by index instead
      .sort((a, b) =>
        a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
      )
  );
}

/**
 * Ranks and picks the best route to match. Each segment gets the highest
 * amount of points, then the type of segment gets an additional amount of
 * points where
 *
 *  static > dynamic > splat > root
 *
 * This way we don't have to worry about the order of our routes, let the
 * computers do it.
 *
 * A route looks like this
 *
 *  { path, default, value }
 *
 * And a returned match looks like:
 *
 *  { route, params, uri }
 *
 * @param {object[]} routes
 * @param {string} uri
 * @return {?object}
 */
function pick(routes, uri) {
  let match;
  let default_;

  const [uriPathname] = uri.split("?");
  const uriSegments = segmentize(uriPathname);
  const isRootUri = uriSegments[0] === "";
  const ranked = rankRoutes(routes);

  for (let i = 0, l = ranked.length; i < l; i++) {
    const route = ranked[i].route;
    let missed = false;

    if (route.default) {
      default_ = {
        route,
        params: {},
        uri
      };
      continue;
    }

    const routeSegments = segmentize(route.path);
    const params = {};
    const max = Math.max(uriSegments.length, routeSegments.length);
    let index = 0;

    for (; index < max; index++) {
      const routeSegment = routeSegments[index];
      const uriSegment = uriSegments[index];

      if (routeSegment !== undefined && isSplat(routeSegment)) {
        // Hit a splat, just grab the rest, and return a match
        // uri:   /files/documents/work
        // route: /files/* or /files/*splatname
        const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

        params[splatName] = uriSegments
          .slice(index)
          .map(decodeURIComponent)
          .join("/");
        break;
      }

      if (uriSegment === undefined) {
        // URI is shorter than the route, no match
        // uri:   /users
        // route: /users/:userId
        missed = true;
        break;
      }

      let dynamicMatch = paramRe.exec(routeSegment);

      if (dynamicMatch && !isRootUri) {
        const value = decodeURIComponent(uriSegment);
        params[dynamicMatch[1]] = value;
      } else if (routeSegment !== uriSegment) {
        // Current segments don't match, not dynamic, not splat, so no match
        // uri:   /users/123/settings
        // route: /users/:id/profile
        missed = true;
        break;
      }
    }

    if (!missed) {
      match = {
        route,
        params,
        uri: "/" + uriSegments.slice(0, index).join("/")
      };
      break;
    }
  }

  return match || default_ || null;
}

/**
 * Check if the `path` matches the `uri`.
 * @param {string} path
 * @param {string} uri
 * @return {?object}
 */
function match(route, uri) {
  return pick([route], uri);
}

/**
 * Add the query to the pathname if a query is given
 * @param {string} pathname
 * @param {string} [query]
 * @return {string}
 */
function addQuery(pathname, query) {
  return pathname + (query ? `?${query}` : "");
}

/**
 * Resolve URIs as though every path is a directory, no files. Relative URIs
 * in the browser can feel awkward because not only can you be "in a directory",
 * you can be "at a file", too. For example:
 *
 *  browserSpecResolve('foo', '/bar/') => /bar/foo
 *  browserSpecResolve('foo', '/bar') => /foo
 *
 * But on the command line of a file system, it's not as complicated. You can't
 * `cd` from a file, only directories. This way, links have to know less about
 * their current path. To go deeper you can do this:
 *
 *  <Link to="deeper"/>
 *  // instead of
 *  <Link to=`{${props.uri}/deeper}`/>
 *
 * Just like `cd`, if you want to go deeper from the command line, you do this:
 *
 *  cd deeper
 *  # not
 *  cd $(pwd)/deeper
 *
 * By treating every path as a directory, linking to relative paths should
 * require less contextual information and (fingers crossed) be more intuitive.
 * @param {string} to
 * @param {string} base
 * @return {string}
 */
function resolve(to, base) {
  // /foo/bar, /baz/qux => /foo/bar
  if (startsWith(to, "/")) {
    return to;
  }

  const [toPathname, toQuery] = to.split("?");
  const [basePathname] = base.split("?");
  const toSegments = segmentize(toPathname);
  const baseSegments = segmentize(basePathname);

  // ?a=b, /users?b=c => /users?a=b
  if (toSegments[0] === "") {
    return addQuery(basePathname, toQuery);
  }

  // profile, /users/789 => /users/789/profile
  if (!startsWith(toSegments[0], ".")) {
    const pathname = baseSegments.concat(toSegments).join("/");

    return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
  }

  // ./       , /users/123 => /users/123
  // ../      , /users/123 => /users
  // ../..    , /users/123 => /
  // ../../one, /a/b/c/d   => /a/b/one
  // .././one , /a/b/c/d   => /a/b/c/one
  const allSegments = baseSegments.concat(toSegments);
  const segments = [];

  allSegments.forEach(segment => {
    if (segment === "..") {
      segments.pop();
    } else if (segment !== ".") {
      segments.push(segment);
    }
  });

  return addQuery("/" + segments.join("/"), toQuery);
}

/**
 * Combines the `basepath` and the `path` into one path.
 * @param {string} basepath
 * @param {string} path
 */
function combinePaths(basepath, path) {
  return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/`;
}

/* node_modules/svelte-routing/src/Router.svelte generated by Svelte v3.24.0 */

const Router = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let $base;
	let $location;
	let $routes;
	let { basepath = "/" } = $$props;
	let { url = null } = $$props;
	const locationContext = getContext(LOCATION);
	const routerContext = getContext(ROUTER);
	const routes = writable([]);
	$routes = get_store_value(routes);
	const activeRoute = writable(null);
	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

	// If locationContext is not set, this is the topmost Router in the tree.
	// If the `url` prop is given we force the location to it.
	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

	$location = get_store_value(location);

	// If routerContext is set, the routerBase of the parent Router
	// will be the base for this Router's descendants.
	// If routerContext is not set, the path and resolved uri will both
	// have the value of the basepath prop.
	const base = routerContext
	? routerContext.routerBase
	: writable({ path: basepath, uri: basepath });

	$base = get_store_value(base);

	const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
		// If there is no activeRoute, the routerBase will be identical to the base.
		if (activeRoute === null) {
			return base;
		}

		const { path: basepath } = base;
		const { route, uri } = activeRoute;

		// Remove the potential /* or /*splatname from
		// the end of the child Routes relative paths.
		const path = route.default
		? basepath
		: route.path.replace(/\*.*$/, "");

		return { path, uri };
	});

	function registerRoute(route) {
		const { path: basepath } = $base;
		let { path } = route;

		// We store the original path in the _path property so we can reuse
		// it when the basepath changes. The only thing that matters is that
		// the route reference is intact, so mutation is fine.
		route._path = path;

		route.path = combinePaths(basepath, path);

		if (typeof window === "undefined") {
			// In SSR we should set the activeRoute immediately if it is a match.
			// If there are more Routes being registered after a match is found,
			// we just skip them.
			if (hasActiveRoute) {
				return;
			}

			const matchingRoute = match(route, $location.pathname);

			if (matchingRoute) {
				activeRoute.set(matchingRoute);
				hasActiveRoute = true;
			}
		} else {
			routes.update(rs => {
				rs.push(route);
				return rs;
			});
		}
	}

	function unregisterRoute(route) {
		routes.update(rs => {
			const index = rs.indexOf(route);
			rs.splice(index, 1);
			return rs;
		});
	}

	if (!locationContext) {
		// The topmost Router in the tree is responsible for updating
		// the location store and supplying it through context.
		onMount(() => {
			const unlisten = globalHistory.listen(history => {
				location.set(history.location);
			});

			return unlisten;
		});

		setContext(LOCATION, location);
	}

	setContext(ROUTER, {
		activeRoute,
		base,
		routerBase,
		registerRoute,
		unregisterRoute
	});

	if ($$props.basepath === void 0 && $$bindings.basepath && basepath !== void 0) $$bindings.basepath(basepath);
	if ($$props.url === void 0 && $$bindings.url && url !== void 0) $$bindings.url(url);
	$base = get_store_value(base);
	$location = get_store_value(location);
	$routes = get_store_value(routes);

	 {
		{
			const { path: basepath } = $base;

			routes.update(rs => {
				rs.forEach(r => r.path = combinePaths(basepath, r._path));
				return rs;
			});
		}
	}

	 {
		{
			const bestMatch = pick($routes, $location.pathname);
			activeRoute.set(bestMatch);
		}
	}

	return `${$$slots.default ? $$slots.default({}) : ``}`;
});

/* node_modules/svelte-routing/src/Route.svelte generated by Svelte v3.24.0 */

const Route = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let $activeRoute;
	let $location;
	let { path = "" } = $$props;
	let { component = null } = $$props;
	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
	$activeRoute = get_store_value(activeRoute);
	const location = getContext(LOCATION);
	$location = get_store_value(location);

	const route = {
		path,
		// If no path prop is given, this Route will act as the default Route
		// that is rendered if no other Route in the Router is a match.
		default: path === ""
	};

	let routeParams = {};
	let routeProps = {};
	registerRoute(route);

	// There is no need to unregister Routes in SSR since it will all be
	// thrown away anyway.
	if (typeof window !== "undefined") {
		onDestroy(() => {
			unregisterRoute(route);
		});
	}

	if ($$props.path === void 0 && $$bindings.path && path !== void 0) $$bindings.path(path);
	if ($$props.component === void 0 && $$bindings.component && component !== void 0) $$bindings.component(component);
	$activeRoute = get_store_value(activeRoute);
	$location = get_store_value(location);

	 {
		if ($activeRoute && $activeRoute.route === route) {
			routeParams = $activeRoute.params;
		}
	}

	 {
		{
			const { path, component, ...rest } = $$props;
			routeProps = rest;
		}
	}

	return `${$activeRoute !== null && $activeRoute.route === route
	? `${component !== null
		? `${validate_component(component || missing_component, "svelte:component").$$render($$result, Object.assign({ location: $location }, routeParams, routeProps), {}, {})}`
		: `${$$slots.default
			? $$slots.default({ params: routeParams, location: $location })
			: ``}`}`
	: ``}`;
});

/* node_modules/svelte-routing/src/Link.svelte generated by Svelte v3.24.0 */

const Link = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let $base;
	let $location;
	let { to = "#" } = $$props;
	let { replace = false } = $$props;
	let { state = {} } = $$props;
	let { getProps = () => ({}) } = $$props;
	const { base } = getContext(ROUTER);
	$base = get_store_value(base);
	const location = getContext(LOCATION);
	$location = get_store_value(location);
	const dispatch = createEventDispatcher();
	let href, isPartiallyCurrent, isCurrent, props;

	if ($$props.to === void 0 && $$bindings.to && to !== void 0) $$bindings.to(to);
	if ($$props.replace === void 0 && $$bindings.replace && replace !== void 0) $$bindings.replace(replace);
	if ($$props.state === void 0 && $$bindings.state && state !== void 0) $$bindings.state(state);
	if ($$props.getProps === void 0 && $$bindings.getProps && getProps !== void 0) $$bindings.getProps(getProps);
	$base = get_store_value(base);
	$location = get_store_value(location);
	href = to === "/" ? $base.uri : resolve(to, $base.uri);
	isPartiallyCurrent = startsWith($location.pathname, href);
	isCurrent = href === $location.pathname;
	let ariaCurrent = isCurrent ? "page" : undefined;

	props = getProps({
		location: $location,
		href,
		isPartiallyCurrent,
		isCurrent
	});

	return `<a${spread([{ href: escape(href) }, { "aria-current": escape(ariaCurrent) }, props])}>${$$slots.default ? $$slots.default({}) : ``}</a>`;
});

const cocktails = writable([]);
const searchText = writable("");
const ingredients = writable([]);

const createFavorites = () => {
const { subscribe, update } = writable([]);

    return {
        subscribe,
        add: (cocktail) => update(fav => [...fav, cocktail]),
        remove: (cocktailId) => update((fav) => fav.filter((f) => f.idDrink !== cocktailId)),
    };
};

const favorites = createFavorites();

/* src/Header.svelte generated by Svelte v3.24.0 */

const css = {
	code: ".header.svelte-1clmj20.svelte-1clmj20{display:flex;justify-content:space-between;align-items:center}.logo.svelte-1clmj20.svelte-1clmj20{display:flex}.logo.svelte-1clmj20 img.svelte-1clmj20{width:50px;margin-right:8px}.red.svelte-1clmj20.svelte-1clmj20{color:#e94444;text-decoration:underline}",
	map: "{\"version\":3,\"file\":\"Header.svelte\",\"sources\":[\"Header.svelte\"],\"sourcesContent\":[\"<script>\\n  import { favorites } from './stores.js';\\n  import { Link } from 'svelte-routing';\\n</script>\\n\\n<style>\\n  .header {\\n    display: flex;\\n    justify-content: space-between;\\n    align-items: center;\\n  }\\n  .logo {\\n    display: flex;\\n}\\n  .logo img {\\n    width: 50px;\\n    margin-right: 8px;\\n  }\\n  .red {\\n  color: #e94444;\\n  text-decoration: underline;\\n  }\\n</style>\\n\\n<div class=\\\"header\\\">\\n  <Link to=\\\"/cocktails\\\">\\n    <div class=\\\"logo\\\">\\n    <img  src=\\\"../images/cocktail.svg\\\" alt=\\\"logo\\\" />\\n    <h2>Cocktail time !</h2>\\n    </div>\\n  </Link>\\n  {#if $favorites.length > 0}\\n    <Link to=\\\"/favorites\\\">\\n      <span class=\\\"red\\\">My favorites({$favorites.length})</span>\\n    </Link>\\n  {/if}\\n</div>\\n\"],\"names\":[],\"mappings\":\"AAME,OAAO,8BAAC,CAAC,AACP,OAAO,CAAE,IAAI,CACb,eAAe,CAAE,aAAa,CAC9B,WAAW,CAAE,MAAM,AACrB,CAAC,AACD,KAAK,8BAAC,CAAC,AACL,OAAO,CAAE,IAAI,AACjB,CAAC,AACC,oBAAK,CAAC,GAAG,eAAC,CAAC,AACT,KAAK,CAAE,IAAI,CACX,YAAY,CAAE,GAAG,AACnB,CAAC,AACD,IAAI,8BAAC,CAAC,AACN,KAAK,CAAE,OAAO,CACd,eAAe,CAAE,SAAS,AAC1B,CAAC\"}"
};

const Header = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let $favorites = get_store_value(favorites);
	$$result.css.add(css);

	return `<div class="${"header svelte-1clmj20"}">${validate_component(Link, "Link").$$render($$result, { to: "/cocktails" }, {}, {
		default: () => `<div class="${"logo svelte-1clmj20"}"><img src="${"../images/cocktail.svg"}" alt="${"logo"}" class="${"svelte-1clmj20"}">
    <h2>Cocktail time !</h2></div>`
	})}
  ${$favorites.length > 0
	? `${validate_component(Link, "Link").$$render($$result, { to: "/favorites" }, {}, {
			default: () => `<span class="${"red svelte-1clmj20"}">My favorites(${escape($favorites.length)})</span>`
		})}`
	: ``}</div>`;
});

/* src/CocktailsGrid.svelte generated by Svelte v3.24.0 */

const css$1 = {
	code: ".cocktails.svelte-dlrgbv{margin-top:10px;width:100%;display:grid;grid-template-columns:repeat(6, 1fr);grid-gap:8px}figure.svelte-dlrgbv,img.svelte-dlrgbv{width:100%;margin:0;text-align:center}img.svelte-dlrgbv{border-radius:200px}@media screen and (max-width: 780px){.cocktails.svelte-dlrgbv{grid-template-columns:repeat(2, 1fr)}}",
	map: "{\"version\":3,\"file\":\"CocktailsGrid.svelte\",\"sources\":[\"CocktailsGrid.svelte\"],\"sourcesContent\":[\"<script>\\n  import { Link } from 'svelte-routing';\\n  import Header from './Header.svelte';\\n\\n  export let cocktails;\\n</script>\\n\\n<style>\\n  .cocktails {\\n    margin-top: 10px;\\n    width: 100%;\\n    display: grid;\\n    grid-template-columns: repeat(6, 1fr);\\n    grid-gap: 8px;\\n  }\\n\\n  figure,\\n  img {\\n    width: 100%;\\n    margin: 0;\\n    text-align: center;\\n  }\\n  img {\\n    border-radius: 200px;\\n  }\\n\\n  a {\\n    cursor: pointer;\\n  }\\n\\n  @media screen and (max-width: 780px) {\\n    .cocktails {\\n      grid-template-columns: repeat(2, 1fr);\\n    }\\n  }\\n</style>\\n\\n<div class=\\\"cocktails\\\">\\n  {#if !cocktails}\\n    <p>Votre recherche n'a pas abouti</p>\\n  {:else}\\n    {#each cocktails as cocktail}\\n      <Link to={`cocktails/${cocktail.idDrink}`}>\\n        <figure>\\n          <img\\n            src={`${cocktail.strDrinkThumb}/preview`}\\n            alt={cocktail.strDrink} />\\n          <figcaption>{cocktail.strDrink}</figcaption>\\n        </figure>\\n      </Link>\\n    {/each}\\n  {/if}\\n</div>\\n\"],\"names\":[],\"mappings\":\"AAQE,UAAU,cAAC,CAAC,AACV,UAAU,CAAE,IAAI,CAChB,KAAK,CAAE,IAAI,CACX,OAAO,CAAE,IAAI,CACb,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,CACrC,QAAQ,CAAE,GAAG,AACf,CAAC,AAED,oBAAM,CACN,GAAG,cAAC,CAAC,AACH,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,CAAC,CACT,UAAU,CAAE,MAAM,AACpB,CAAC,AACD,GAAG,cAAC,CAAC,AACH,aAAa,CAAE,KAAK,AACtB,CAAC,AAMD,OAAO,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACpC,UAAU,cAAC,CAAC,AACV,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,AACvC,CAAC,AACH,CAAC\"}"
};

const CocktailsGrid = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let { cocktails } = $$props;
	if ($$props.cocktails === void 0 && $$bindings.cocktails && cocktails !== void 0) $$bindings.cocktails(cocktails);
	$$result.css.add(css$1);

	return `<div class="${"cocktails svelte-dlrgbv"}">${!cocktails
	? `<p>Votre recherche n&#39;a pas abouti</p>`
	: `${each(cocktails, cocktail => `${validate_component(Link, "Link").$$render($$result, { to: `cocktails/${cocktail.idDrink}` }, {}, {
			default: () => `<figure class="${"svelte-dlrgbv"}"><img${add_attribute("src", `${cocktail.strDrinkThumb}/preview`, 0)}${add_attribute("alt", cocktail.strDrink, 0)} class="${"svelte-dlrgbv"}">
          <figcaption>${escape(cocktail.strDrink)}</figcaption></figure>
      `
		})}`)}`}</div>`;
});

/* node_modules/carbon-icons-svelte/lib/AddAlt32/AddAlt32.svelte generated by Svelte v3.24.0 */

const AddAlt32 = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let { class: className = undefined } = $$props;
	let { id = undefined } = $$props;
	let { tabindex = undefined } = $$props;
	let { focusable = false } = $$props;
	let { title = undefined } = $$props;
	let { style = undefined } = $$props;
	if ($$props.class === void 0 && $$bindings.class && className !== void 0) $$bindings.class(className);
	if ($$props.id === void 0 && $$bindings.id && id !== void 0) $$bindings.id(id);
	if ($$props.tabindex === void 0 && $$bindings.tabindex && tabindex !== void 0) $$bindings.tabindex(tabindex);
	if ($$props.focusable === void 0 && $$bindings.focusable && focusable !== void 0) $$bindings.focusable(focusable);
	if ($$props.title === void 0 && $$bindings.title && title !== void 0) $$bindings.title(title);
	if ($$props.style === void 0 && $$bindings.style && style !== void 0) $$bindings.style(style);
	let ariaLabel = $$props["aria-label"];
	let ariaLabelledBy = $$props["aria-labelledby"];
	let labelled = ariaLabel || ariaLabelledBy || title;

	let attributes = {
		"aria-label": ariaLabel,
		"aria-labelledby": ariaLabelledBy,
		"aria-hidden": labelled ? undefined : true,
		role: labelled ? "img" : undefined,
		focusable: tabindex === "0" ? true : focusable,
		tabindex
	};

	return `<svg${spread([
		{ viewBox: "0 0 32 32" },
		{ "data-carbon-icon": "AddAlt32" },
		{ xmlns: "http://www.w3.org/2000/svg" },
		{ fill: "currentColor" },
		{ width: "32" },
		{ height: "32" },
		{ class: escape(className) },
		{ preserveAspectRatio: "xMidYMid meet" },
		{ style: escape(style) },
		{ id: escape(id) },
		attributes
	])}><path d="${"M16,4c6.6,0,12,5.4,12,12s-5.4,12-12,12S4,22.6,4,16S9.4,4,16,4 M16,2C8.3,2,2,8.3,2,16s6.3,14,14,14s14-6.3,14-14\tS23.7,2,16,2z"}"></path><path d="${"M24 15L17 15 17 8 15 8 15 15 8 15 8 17 15 17 15 24 17 24 17 17 24 17z"}"></path>${$$slots.default
	? $$slots.default({})
	: `
    ${title ? `<title>${escape(title)}</title>` : ``}
  `}</svg>`;
});

/* src/Search.svelte generated by Svelte v3.24.0 */

const css$2 = {
	code: ".showFilter.svelte-1elq8oc{margin-top:8px;margin-bottom:8px}",
	map: "{\"version\":3,\"file\":\"Search.svelte\",\"sources\":[\"Search.svelte\"],\"sourcesContent\":[\"<script>\\n  import { onMount } from 'svelte';\\n  import {\\n    cocktails,\\n    searchText,\\n    ingredients,\\n  } from './stores.js';\\n  import { navigate, Link } from 'svelte-routing';\\nimport AddAlt32 from \\\"carbon-icons-svelte/lib/AddAlt32\\\";\\nimport SubtractAlt32 from \\\"carbon-icons-svelte/lib/SubtractAlt32\\\";\\n\\n  let showFilter = false;\\n\\n  onMount(async () => {\\n    if ($ingredients.length > 0) {\\n      return;\\n    }\\n    const res = await fetch(\\n      'https://www.thecocktaildb.com/api/json/v1/1/list.php?i=list'\\n    ).then((res) => res.json());\\n    ingredients.set(res.drinks);\\n  });\\n\\n  const submitFilter = async (ingredient) => {\\n    const res = await fetch(\\n      `https://www.thecocktaildb.com/api/json/v1/1/filter.php?i=${ingredient}`\\n    );\\n    const drinks = await res\\n      .json()\\n      .then((res) => res.drinks);\\n    cocktails.set(drinks);\\n    navigate('/cocktails');\\n  };\\n\\n  const search = async (e) => {\\n    e.preventDefault();\\n    const value = e.target.value;\\n    const res = await fetch(\\n      `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${value}`\\n    );\\n    const drinks = await res\\n      .json()\\n      .then((res) => res.drinks);\\n    cocktails.set(drinks);\\n    navigate('/cocktails');\\n  };\\n\\n  const toggleShowFilter = () => (showFilter = !showFilter);\\n</script>\\n\\n<style>\\n  .showFilter {\\n    margin-top: 8px;\\n    margin-bottom: 8px;\\n  }\\n</style>\\n<div>\\n  <label for=\\\"search\\\">Search by name</label>\\n  <input\\n    bind:value={$searchText}\\n    placeholder=\\\"Search\\\"\\n    name=\\\"search\\\"\\n    preventDefault\\n    on:keydown={(e) => e.key === 'Enter' && search(e)} />\\n</div>\\n  --- OR ---\\n  <div on:click={() => toggleShowFilter()} href=\\\"#\\\" class=\\\"showFilter\\\">\\n  {#if showFilter}\\n    <SubtractAlt32 class=\\\"icon\\\" aria-label=\\\"Hide\\\" />\\nHide ingredient filter\\n  {:else}\\n    <AddAlt32 class=\\\"icon\\\" aria-label=\\\"Show\\\" />\\nShow ingredient filter{/if}\\n  </div>\\n\\n{#if showFilter}\\n  <div>\\n    <label for=\\\"choix_bieres\\\">Filter by ingredient :</label>\\n    <input\\n      on:change={(e) => submitFilter(e.target.value)}\\n      list=\\\"ingredients\\\"\\n      type=\\\"text\\\"\\n      id=\\\"ingredients-choice\\\" />\\n    <datalist id=\\\"ingredients\\\">\\n      {#each $ingredients as { strIngredient1 }}\\n        <option value={strIngredient1} />\\n      {/each}\\n    </datalist>\\n  </div>\\n{/if}\\n\"],\"names\":[],\"mappings\":\"AAmDE,WAAW,eAAC,CAAC,AACX,UAAU,CAAE,GAAG,CACf,aAAa,CAAE,GAAG,AACpB,CAAC\"}"
};

const Search = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let $ingredients = get_store_value(ingredients);
	let $searchText = get_store_value(searchText);

	onMount(async () => {
		if ($ingredients.length > 0) {
			return;
		}

		const res = await fetch("https://www.thecocktaildb.com/api/json/v1/1/list.php?i=list").then(res => res.json());
		ingredients.set(res.drinks);
	});
	$$result.css.add(css$2);

	return `<div><label for="${"search"}">Search by name</label>
  <input placeholder="${"Search"}" name="${"search"}" preventDefault${add_attribute("value", $searchText, 1)}></div>
  --- OR ---
  <div href="${"#"}" class="${"showFilter svelte-1elq8oc"}">${ `${validate_component(AddAlt32, "AddAlt32").$$render($$result, { class: "icon", "aria-label": "Show" }, {}, {})}
Show ingredient filter`}</div>

${ ``}`;
});

/* src/CocktailsList.svelte generated by Svelte v3.24.0 */

const CocktailsList = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let $cocktails = get_store_value(cocktails);

	return `${validate_component(Header, "Header").$$render($$result, {}, {}, {})}
${validate_component(Search, "Search").$$render($$result, {}, {}, {})}
${$cocktails.length > 0
	? `<h3>Results (${escape($cocktails.length)}) :</h3>
${validate_component(CocktailsGrid, "CocktailsGrid").$$render($$result, { cocktails: $cocktails }, {}, {})}`
	: ``}`;
});

/* node_modules/carbon-icons-svelte/lib/StarFilled32/StarFilled32.svelte generated by Svelte v3.24.0 */

const StarFilled32 = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let { class: className = undefined } = $$props;
	let { id = undefined } = $$props;
	let { tabindex = undefined } = $$props;
	let { focusable = false } = $$props;
	let { title = undefined } = $$props;
	let { style = undefined } = $$props;
	if ($$props.class === void 0 && $$bindings.class && className !== void 0) $$bindings.class(className);
	if ($$props.id === void 0 && $$bindings.id && id !== void 0) $$bindings.id(id);
	if ($$props.tabindex === void 0 && $$bindings.tabindex && tabindex !== void 0) $$bindings.tabindex(tabindex);
	if ($$props.focusable === void 0 && $$bindings.focusable && focusable !== void 0) $$bindings.focusable(focusable);
	if ($$props.title === void 0 && $$bindings.title && title !== void 0) $$bindings.title(title);
	if ($$props.style === void 0 && $$bindings.style && style !== void 0) $$bindings.style(style);
	let ariaLabel = $$props["aria-label"];
	let ariaLabelledBy = $$props["aria-labelledby"];
	let labelled = ariaLabel || ariaLabelledBy || title;

	let attributes = {
		"aria-label": ariaLabel,
		"aria-labelledby": ariaLabelledBy,
		"aria-hidden": labelled ? undefined : true,
		role: labelled ? "img" : undefined,
		focusable: tabindex === "0" ? true : focusable,
		tabindex
	};

	return `<svg${spread([
		{ viewBox: "0 0 32 32" },
		{ "data-carbon-icon": "StarFilled32" },
		{ xmlns: "http://www.w3.org/2000/svg" },
		{ fill: "currentColor" },
		{ width: "32" },
		{ height: "32" },
		{ class: escape(className) },
		{ preserveAspectRatio: "xMidYMid meet" },
		{ style: escape(style) },
		{ id: escape(id) },
		attributes
	])}><path d="${"M16,2l-4.55,9.22L1.28,12.69l7.36,7.18L6.9,30,16,25.22,25.1,30,23.36,19.87l7.36-7.17L20.55,11.22Z"}"></path>${$$slots.default
	? $$slots.default({})
	: `
    ${title ? `<title>${escape(title)}</title>` : ``}
  `}</svg>`;
});

/* src/CocktailDetail.svelte generated by Svelte v3.24.0 */

const css$3 = {
	code: ".cocktail.svelte-1ojlgfa{display:flex}.cocktail-img.svelte-1ojlgfa{flex-basis:40%;max-width:200px;margin-right:12px;position:relative}.bold.svelte-1ojlgfa{font-weight:bold}.button.svelte-1ojlgfa{border:none;background:#e94444;color:white;width:100%;padding:10px 0px}",
	map: "{\"version\":3,\"file\":\"CocktailDetail.svelte\",\"sources\":[\"CocktailDetail.svelte\"],\"sourcesContent\":[\"<script>\\n  import { Link } from 'svelte-routing';\\n  import { onMount, beforeUpdate } from 'svelte';\\n  import Header from './Header.svelte';\\n  import { cocktails, favorites } from './stores.js';\\n  import StarFilled32 from \\\"carbon-icons-svelte/lib/StarFilled32\\\";\\n\\n  export let id;\\n  let cocktail;\\n  let ingredients = [];\\n\\n  const fetchCocktail = async () => {\\n    const res = await fetch(\\n      `https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=${id}`\\n    );\\n    return await res.json().then((res) => res.drinks[0]);\\n  };\\n  \\n  let isFavorite = $favorites.some(fav => fav.idDrink === id)\\n\\nbeforeUpdate(() => {\\n\\tisFavorite = $favorites.some(fav => fav.idDrink === id)\\n});\\n\\n  onMount(async () => {\\n    cocktail = isFavorite ? $favorites.find(fav => fav.idDrink === id) : await fetchCocktail();\\n    for (const [key, value] of Object.entries(cocktail)) {\\n      if (key.includes('strIngredient') && value) {\\n        ingredients = [...ingredients, value];\\n      }\\n    }\\n    ingredients = ingredients.map(\\n      (ingredient, i) =>\\n        `${ingredient} : ${cocktail[`strMeasure${i + 1}`]}`\\n    );\\n  });\\n</script>\\n\\n<style>\\n  .cocktail {\\n    display: flex;\\n  }\\n  .cocktail-img {\\n    flex-basis: 40%;\\n    max-width: 200px;\\n    margin-right: 12px;\\n    position: relative;\\n  }\\n  .bold {\\n    font-weight: bold;\\n  }\\n\\n  .button {\\n    border: none;\\n    background: #e94444;\\n    color: white;\\n    width: 100%;\\n    padding: 10px 0px;\\n  }\\n  .icon {\\n    color: #e94444;\\n    position: absolute;\\n    left: 5px;\\n    top: 5px;\\n  }\\n</style>\\n\\n<Header />\\n{#if cocktail}\\n  <h3>{cocktail.strDrink}</h3>\\n  <div class=\\\"cocktail\\\">\\n    <div class=\\\"cocktail-img\\\">\\n      {#if isFavorite}\\n        <StarFilled32 class=\\\"icon favorite\\\"/>\\n      {/if}\\n      <img\\n        width=\\\"100%\\\"\\n        src={`${cocktail.strDrinkThumb}/preview`}\\n        alt={cocktail.strDrink} />\\n      {#if isFavorite}\\n        <button class=\\\"button\\\" on:click={favorites.remove(cocktail.idDrink)}>\\n          Remove favorite\\n        </button>\\n      {:else}\\n        <button class=\\\"button\\\" on:click={favorites.add(cocktail)}>\\n          Add to favorites\\n        </button>\\n      {/if}\\n    </div>\\n    <div>\\n      <span class=\\\"bold\\\">Ingredients</span>\\n      <ul>\\n        {#each ingredients as ingredient}\\n          <li>{ingredient}</li>\\n        {/each}\\n      </ul>\\n    </div>\\n  </div>\\n  <h4>Instructions</h4>\\n  <span>{cocktail.strInstructions}</span>\\n{:else}\\n  <p>...waiting</p>\\n{/if}\\n\"],\"names\":[],\"mappings\":\"AAuCE,SAAS,eAAC,CAAC,AACT,OAAO,CAAE,IAAI,AACf,CAAC,AACD,aAAa,eAAC,CAAC,AACb,UAAU,CAAE,GAAG,CACf,SAAS,CAAE,KAAK,CAChB,YAAY,CAAE,IAAI,CAClB,QAAQ,CAAE,QAAQ,AACpB,CAAC,AACD,KAAK,eAAC,CAAC,AACL,WAAW,CAAE,IAAI,AACnB,CAAC,AAED,OAAO,eAAC,CAAC,AACP,MAAM,CAAE,IAAI,CACZ,UAAU,CAAE,OAAO,CACnB,KAAK,CAAE,KAAK,CACZ,KAAK,CAAE,IAAI,CACX,OAAO,CAAE,IAAI,CAAC,GAAG,AACnB,CAAC\"}"
};

const CocktailDetail = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let $favorites = get_store_value(favorites);
	let { id } = $$props;
	let cocktail;
	let ingredients = [];

	const fetchCocktail = async () => {
		const res = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=${id}`);
		return await res.json().then(res => res.drinks[0]);
	};

	let isFavorite = $favorites.some(fav => fav.idDrink === id);

	beforeUpdate(() => {
		isFavorite = $favorites.some(fav => fav.idDrink === id);
	});

	onMount(async () => {
		cocktail = isFavorite
		? $favorites.find(fav => fav.idDrink === id)
		: await fetchCocktail();

		for (const [key, value] of Object.entries(cocktail)) {
			if (key.includes("strIngredient") && value) {
				ingredients = [...ingredients, value];
			}
		}

		ingredients = ingredients.map((ingredient, i) => `${ingredient} : ${cocktail[`strMeasure${i + 1}`]}`);
	});

	if ($$props.id === void 0 && $$bindings.id && id !== void 0) $$bindings.id(id);
	$$result.css.add(css$3);

	return `${validate_component(Header, "Header").$$render($$result, {}, {}, {})}
${cocktail
	? `<h3>${escape(cocktail.strDrink)}</h3>
  <div class="${"cocktail svelte-1ojlgfa"}"><div class="${"cocktail-img svelte-1ojlgfa"}">${isFavorite
		? `${validate_component(StarFilled32, "StarFilled32").$$render($$result, { class: "icon favorite" }, {}, {})}`
		: ``}
      <img width="${"100%"}"${add_attribute("src", `${cocktail.strDrinkThumb}/preview`, 0)}${add_attribute("alt", cocktail.strDrink, 0)}>
      ${isFavorite
		? `<button class="${"button svelte-1ojlgfa"}">Remove favorite
        </button>`
		: `<button class="${"button svelte-1ojlgfa"}">Add to favorites
        </button>`}</div>
    <div><span class="${"bold svelte-1ojlgfa"}">Ingredients</span>
      <ul>${each(ingredients, ingredient => `<li>${escape(ingredient)}</li>`)}</ul></div></div>
  <h4>Instructions</h4>
  <span>${escape(cocktail.strInstructions)}</span>`
	: `<p>...waiting</p>`}`;
});

/* src/Favorites.svelte generated by Svelte v3.24.0 */

const Favorites = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let $favorites = get_store_value(favorites);

	return `${validate_component(Header, "Header").$$render($$result, {}, {}, {})}
<h3>My favorites</h3>
${$favorites.length > 0
	? `${validate_component(CocktailsGrid, "CocktailsGrid").$$render($$result, { cocktails: $favorites }, {}, {})}`
	: ``}`;
});

/* src/App.svelte generated by Svelte v3.24.0 */

const App = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let { url = "" } = $$props;
	if ($$props.url === void 0 && $$bindings.url && url !== void 0) $$bindings.url(url);

	return `<div class="${"app"}">${validate_component(Router, "Router").$$render($$result, { url }, {}, {
		default: () => `${validate_component(Route, "Route").$$render(
			$$result,
			{
				path: "cocktails",
				component: CocktailsList
			},
			{},
			{}
		)}
    ${validate_component(Route, "Route").$$render($$result, { path: "cocktails/:id" }, {}, {
			default: ({ params }) => `${validate_component(CocktailDetail, "CocktailDetail").$$render($$result, { id: params.id }, {}, {})}`
		})}
    ${validate_component(Route, "Route").$$render($$result, { path: "favorites", component: Favorites }, {}, {})}`
	})}</div>`;
});

module.exports = App;
