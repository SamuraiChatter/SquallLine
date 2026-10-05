# Map data

`map.json` holds the territory's main roads, its rural grid of county roads,
its cities, towns and villages, and its county lines: central Oklahoma around Norman, from 34.8 to 35.7 north
and 98.0 to 97.0 west.

The data is © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors and is available under the
[Open Database License](https://opendatacommons.org/licenses/odbl/1-0/) (ODbL
1.0). That licence covers this file only; the rest of the repo is all rights
reserved.

## Remaking the file

    node tools/bake-map.js

Run it when the territory changes, then commit the new `map.json`. It asks
OpenStreetMap's Overpass service for the data, so it needs the internet. The
game never does: it only loads the file.

## What is in it

- `credit`: the OpenStreetMap credit and licence.
- `bounds`: the edges of the territory.
- `roads`: each has a `class` (motorway, trunk, primary, secondary, tertiary
  or unclassified, and their `_link` ramps, or residential for the rural
  grid), a `name`, a `ref` (its number, such as `I 35`) and its `points`.
  Roads that meet share a point.
- `places`: each has a `kind` (city, town or village), a `name`, and its
  `lon` and `lat`.
- `counties`: the county lines, each a list of points.

Every point in a road or county line is `[longitude, latitude]`.

## The rural grid

OpenStreetMap gives the one-mile grid of county roads and city streets the
same class, residential. `tools/grid-roads.js` tells them apart in two steps:

1. It keeps a road only where roads are thinly packed along it: 3 miles of
   residential road or less in each square mile around it, on average. A
   one-mile grid has about 2, and a town has 10 or more.
2. It trims away what leads nowhere: driveways, culs-de-sac and the tail of a
   road past its last junction.

Of about 8,400 miles of residential road in the territory, about 1,800 are
kept. No city streets are left in Norman, Moore or Oklahoma City. A few
small loops are left on the edges of towns.

The grid has gaps of two miles, and now and then three, where OpenStreetMap
has no residential road on a section line.
