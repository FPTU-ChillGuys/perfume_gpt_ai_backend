# 🎯 Recommendation System V3 (Simple & Practical)

---

## 1. 🎯 Mục tiêu

Thiết kế hệ thống recommendation:
- Đơn giản
- Dễ debug
- Dễ mở rộng
- Phù hợp project nhỏ → trung bình

---

## 2. 🧠 Triết lý thiết kế

> Ít nhưng chất lượng > Nhiều nhưng nhiễu

Chỉ dùng 2 nguồn dữ liệu chính:
- Order (hành vi thật)
- Survey (ý định)

---

## 3. 🧩 Data Input

### 3.1 Order

Dùng để extract:
- Brand preference
- Scent preference
- Budget
- Frequency

### 3.2 Survey

Dùng để extract:
- Scent (fallback hoặc bổ sung)
- Style
- Occasion

---

## 4. ⚙️ Phase 1: User Profile Builder

```ts
profile = {
  topBrands: string[],
  topScents: string[],
  avgPrice: number,
  budgetRange: [min, max],
  age: number,
}
```

### Rule:
- Có order → ưu tiên order
- Không có → fallback survey

---

## 5. 🔍 Phase 2: Candidate Generation

### Cách đơn giản:

```ts
candidates = products.filter(p =>
  matchBrand(p, profile.topBrands) ||
  matchScent(p, profile.topScents)
)
```

> Không cần TopK phức tạp ở giai đoạn này

---

## 6. 🧮 Phase 3: Scoring

### Công thức:

```ts
score =
  brandScore * w1 +
  scentScore * w2 +
  budgetScore * w3 +
  seasonScore * w4
```

---

### 6.1 Dynamic Weight

```ts
if (query.contains("mùa") || context.isSeasonal) {
  w4 += 0.2
}

if (query.contains("giá") || context.isBudgetFocus) {
  w3 += 0.2
}
```

---

### 6.2 Các score

#### Brand Score
- Match với brand đã mua → cao

#### Scent Score
- Match nốt hương → cao

#### Budget Score
- Gần với mức giá user → cao

#### Season Score
- Match mùa hiện tại (local time)

---

## 7. 🧹 Phase 4: Post-processing

### Giữ đơn giản:
- Sort theo score
- Lấy top N

### Optional:
- Dedup variant (cùng dòng sản phẩm)

---

## 8. 🚫 Những gì KHÔNG dùng (giai đoạn này)

- ❌ Event log (click, view)
- ❌ Chat raw message
- ❌ Summary phức tạp
- ❌ Hard filter quá nhiều rule

---

## 9. 📈 Khi nào scale?

Chỉ thêm complexity khi:

- User > vài nghìn
- Product > vài nghìn
- Recommendation bắt đầu sai rõ rệt

---

## 10. 💡 Best Practices

- Log score breakdown để debug
- Luôn explain được "tại sao recommend"
- Tránh overfit rule

---

## 11. 🧠 Example Output

```json
{
  "product": "Dior Sauvage",
  "score": 0.87,
  "reason": [
    "Match brand yêu thích",
    "Hợp nốt hương citrus",
    "Phù hợp budget",
    "Dùng tốt mùa hè"
  ]
}
```

---

# 🚀 Kết luận

System này:
- Nhẹ
- Dễ hiểu
- Dễ maintain

> Khi cần mạnh hơn → build thêm, không build trước.

