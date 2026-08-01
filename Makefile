# Night Roll — no build step; these are conveniences only.
.PHONY: test serve

test:
	node --test tests/*.test.mjs

# fetch() needs http(s), so file:// won't work — serve locally to test the app
serve:
	python3 -m http.server 8000
