import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
	layout("layouts/MainLayout.tsx", [
		index("routes/home.tsx"),
		route("box", "routes/box.tsx"),
		route("leo", "routes/LEO.tsx"),
		route("*", "routes/error.tsx"),
	]),
] satisfies RouteConfig;
