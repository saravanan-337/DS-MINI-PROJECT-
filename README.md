# CellScope (Data Structures Edition)

An EV battery health dashboard built **only with data structures**: no database, no frameworks, no npm packages. It tracks charging sessions for 200 vehicles (4,000 sessions), raises heat alerts (above 45 °C or below 15 °C), and predicts the next peak temperature.

## Run it
Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm start        # or: node server.js
```
Open http://localhost:3000. Admin demo login: `admin@cellscope.com` / `Admin@123` (or sign up with any email and an 8+ character password). Only the admin can open the Fleet view.

## Data structures used (all hand-written in `src/dataStructures.js`)
| Structure | Used for | Cost |
|---|---|---|
| Hash table (chaining) | Vehicle and user lookup by key | O(1) average |
| Linked list | Each vehicle's sessions; login log | O(1) append |
| Trie | Vehicle number autocomplete | O(length) |
| Min-heap (size 5) | Hottest sessions in the fleet | O(log k) insert |
| Binary search tree | Health ranking via in-order traversal | O(log n) avg insert |
| Circular queue | Last 5 peak temperatures give the prediction | O(1) |
| Queue | Heat alerts, first-in first-out | O(1) |
| Stack | Back-button history (frontend) | O(1) |
| Merge sort | Sortable session table | O(n log n) |

## Project structure
```
cellscope-ds/
├── server.js               Backend: HTTP server and API routes
├── src/
│   ├── dataStructures.js   Hand-written data structures and merge sort
│   ├── data.js             Generates 200 vehicles x 20 sessions into the structures
│   └── auth.js             Users (hash table), login log (linked list), password hashing, sessions
├── public/                 Frontend
│   ├── index.html          Dashboard page
│   ├── login.html          Login / sign-up page
│   ├── css/style.css
│   └── js/app.js, login.js
└── package.json
```

## API
| Method and path | Access | Purpose |
|---|---|---|
| `POST /api/login`, `/api/register`, `/api/logout` | public | Authentication |
| `GET /api/me` | user | Current user and role |
| `GET /api/suggest?prefix=` | user | Trie autocomplete |
| `GET /api/vehicles/:no?sort=&dir=` | user | One vehicle (hash lookup, merge-sorted sessions, alert queue) |
| `GET /api/fleet` | admin | Heap, BST ranking and login log |

## Notes
- Data is generated in memory at startup. Accounts and the login log are lost when the server restarts.
- Passwords are hashed with scrypt and a salt; sessions use a signed HttpOnly cookie. This is a course project, not production security.
