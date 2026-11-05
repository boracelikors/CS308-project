const express = require("express");
const cors = require("cors");
const products = require("./sample-products.json"); // Load the six sample products from Hasan's file

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173"; // React (Vite) dev server

app.use(cors({ origin: FRONTEND_ORIGIN })); // Only allow browser requests from our frontend
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Return all sample products as a JSON array
app.get("/products", (req, res) => {
  res.json(products);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});