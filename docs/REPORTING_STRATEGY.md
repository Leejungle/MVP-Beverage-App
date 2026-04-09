# Reporting Strategy

> Defines how daily and monthly reporting should work.

## Context
- Small shop, 1 employee
- ~20-100 orders/day, ~2 items/order average
- SQLite database
- System used long-term for real business decisions

## Short-term Strategy (Current — Phase 3)

### Compute directly from Orders — NO summary tables needed

**Daily reporting**:
```sql
SELECT orderDate, SUM(quantity*unitPrice) as revenue, SUM(quantity*unitCost) as cost
FROM OrderItem JOIN Order ON ...
WHERE orderDate = '2026-04-09'
GROUP BY orderDate
```

**Monthly reporting**:
```sql
SELECT orderDate, SUM(quantity*unitPrice) as revenue, SUM(quantity*unitCost) as cost
FROM OrderItem JOIN Order ON ...
WHERE orderDate LIKE '2026-04%'
GROUP BY orderDate
```

### Why this is sufficient
- 200 OrderItems/day × 30 days = 6,000 rows for monthly query
- SQLite handles 6,000 rows SUM + GROUP BY in < 10ms
- Even yearly (72,000 rows) would be < 100ms
- No concurrent users to compete for resources

### API Design
- `GET /api/dashboard?date=2026-04-09` — single day view (existing)
- `GET /api/dashboard?month=2026-04` — month view with daily breakdown (Phase 3)

### UI Design
- Toggle: "Day" / "Month" on Dashboard page
- Day view: existing cards + product breakdown table
- Month view: daily profit list (date, orders, revenue, cost, profit per row) + monthly totals

## Long-term Strategy (When Needed)

### When to add DailySummary table
Only if ANY of these become true:
- > 1,000 orders/day consistently
- Query response time > 500ms for monthly reports
- Multi-tenant / multi-branch deployment
- Complex analytics (trends, comparisons, forecasting)

### DailySummary schema (future, NOT now)
```
DailySummary {
  date         String @unique  // YYYY-MM-DD
  totalOrders  Int
  totalCups    Int
  totalRevenue Float
  totalCost    Float
  totalProfit  Float
}
```

### How it would work
- End-of-day job or on-demand recalculation
- Dashboard reads from summary instead of raw orders
- Raw orders still available for drill-down

**DO NOT implement DailySummary now. This note exists only for future reference.**
