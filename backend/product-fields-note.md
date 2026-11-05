# Remaining Product Fields (for later sprints)

`sample-products.json` currently uses these fields for every product:
`id`, `name`, `category`, `price`, `currency`, `description`, `image`.

The CS 308 project spec (requirement 9) says a product must have at least:
ID, name, model, serial number, description, quantity in stock, price,
warranty status, and distributor information.

## Required by the spec, not yet in the sample data

| Field (suggested name) | Type    | Notes |
|------------------------|---------|-------|
| `model`                | string  | Manufacturer model code |
| `serialNumber`         | string  | Must be unique per product |
| `quantityInStock`      | integer | Shown to the user; decreases after purchase. Out-of-stock products stay searchable but cannot be added to the cart (req. 3, 7) |
| `warrantyStatus`       | string  | e.g. "2 years" or "No warranty" |
| `distributor`          | string  | Distributor name/info |

## Needed by other requirements (later sprints)

| Field (suggested name) | Type    | Why |
|------------------------|---------|-----|
| `cost`                 | number  | Profit/loss calculation; defaults to 50% of price if not set by the product manager (req. 11) |
| `discountRate`         | number  | Sales manager discounts (req. 11) |
| `popularity` / rating  | number  | Sorting by popularity (req. 7); ratings come from customers (req. 5) |

`id`, `name`, `description` and `price` are already covered.
