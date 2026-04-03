# 🚀 Quick Reference Guide

## Import Shortcuts

### Import All Models
```typescript
import { User, Workspace, Wallet, Category, Transaction, Budget, Notification, ActivityLog } from "@/src/backend/models";
```

### Import All Interfaces
```typescript
import type { IUser, IWorkspace, ITransaction, IBudget } from "@/src/backend/interface";
```

### Import Helpers
```typescript
import { isValidObjectId, sanitizeEmail, formatAmount, paginate } from "@/src/backend/utils/helpers";
```

---

## Common Operations

### ✅ Create User
```typescript
await connectMongoDB();

const user = await User.create({
  name: "John Doe",
  email: "john@example.com",
  password: "securepassword",
  provider: "credentials",
});
```

### ✅ Check Duplicate Email
```typescript
const existingUser = await User.findOne({ 
  email: email.toLowerCase().trim() 
});

if (existingUser) {
  return NextResponse.json(
    { error: "Email already registered" },
    { status: 409 }
  );
}
```

### ✅ Create Workspace
```typescript
const workspace = await Workspace.create({
  name: "My Workspace",
  ownerId: userId,
  isPersonal: true,
  currency: "BDT",
});
```

### ✅ Add Member to Workspace
```typescript
const member = await WorkspaceMember.create({
  workspaceId,
  userId,
  role: "editor",
  invitedBy: currentUserId,
});
```

### ✅ Create Wallet
```typescript
const wallet = await Wallet.create({
  workspaceId,
  name: "Cash Wallet",
  type: "cash",
  balance: 1000,
  currency: "BDT",
});
```

### ✅ Create Category
```typescript
const category = await Category.create({
  workspaceId,
  name: "Food",
  type: "expense",
  isDefault: false,
});
```

### ✅ Create Transaction
```typescript
// Expense/Income
const transaction = await Transaction.create({
  workspaceId,
  userId,
  walletId,
  categoryId,
  type: "expense", // or "income"
  amount: 500,
  note: "Lunch",
  date: new Date(),
});

// Transfer
const transfer = await Transaction.create({
  workspaceId,
  userId,
  type: "transfer",
  amount: 1000,
  fromWalletId: wallet1Id,
  toWalletId: wallet2Id,
  note: "Transfer to savings",
});
```

### ✅ Create Budget
```typescript
const budget = await Budget.create({
  workspaceId,
  categoryId,
  amount: 5000,
  month: 4,
  year: 2026,
});
```

### ✅ Send Notification
```typescript
await Notification.create({
  userId,
  workspaceId,
  type: "budget_exceed",
  message: "You exceeded your food budget!",
  isRead: false,
});
```

### ✅ Log Activity
```typescript
await ActivityLog.create({
  userId,
  workspaceId,
  action: "CREATE_EXPENSE",
  entity: "transaction",
  entityId: transactionId,
  metadata: { amount: 500, category: "Food" },
});
```

---

## Query Examples

### Find User with Population
```typescript
const user = await User.findById(userId)
  .select("-password") // Exclude password
  .populate("defaultWorkspaceId");
```

### Get All Workspaces for User
```typescript
// As owner
const ownedWorkspaces = await Workspace.find({ ownerId: userId });

// As member
const memberships = await WorkspaceMember.find({ userId })
  .populate("workspaceId");

const workspaces = memberships.map(m => m.workspaceId);
```

### Get Transactions with Filters
```typescript
const transactions = await Transaction.find({
  workspaceId,
  userId,
  type: "expense",
  date: {
    $gte: new Date(2026, 3, 1),
    $lt: new Date(2026, 4, 1),
  },
})
  .populate("walletId", "name type")
  .populate("categoryId", "name type")
  .sort({ date: -1 });
```

### Get Wallet Balance
```typescript
const wallet = await Wallet.findById(walletId);
console.log(`Current balance: ${wallet.balance}`);
```

### Calculate Monthly Spending
```typescript
import { getMonthDateRange } from "@/src/backend/utils/helpers";

const { start, end } = getMonthDateRange(4, 2026);

const result = await Transaction.aggregate([
  {
    $match: {
      workspaceId,
      type: "expense",
      date: { $gte: start, $lte: end },
    },
  },
  {
    $group: {
      _id: "$categoryId",
      total: { $sum: "$amount" },
    },
  },
  {
    $lookup: {
      from: "categories",
      localField: "_id",
      foreignField: "_id",
      as: "category",
    },
  },
]);
```

### Check Budget vs Actual
```typescript
const budget = await Budget.findOne({
  workspaceId,
  categoryId,
  month: 4,
  year: 2026,
});

const { start, end } = getMonthDateRange(4, 2026);

const spending = await Transaction.aggregate([
  {
    $match: {
      workspaceId,
      categoryId,
      type: "expense",
      date: { $gte: start, $lte: end },
    },
  },
  { $group: { _id: null, total: { $sum: "$amount" } } },
]);

const remaining = budget.amount - (spending[0]?.total || 0);
```

### Get Unread Notifications
```typescript
const notifications = await Notification.find({
  userId,
  isRead: false,
}).sort({ createdAt: -1 });
```

### Get Recent Activity
```typescript
const activities = await ActivityLog.find({
  workspaceId,
  userId,
})
  .populate("userId", "name email")
  .sort({ createdAt: -1 })
  .limit(20);
```

---

## Update Operations

### Update User Profile
```typescript
const user = await User.findByIdAndUpdate(
  userId,
  {
    name: "New Name",
    image: "new-image-url.jpg",
  },
  { new: true } // Return updated document
).select("-password");
```

### Update Wallet Balance
```typescript
const wallet = await Wallet.findByIdAndUpdate(
  walletId,
  {
    $inc: { balance: -500 }, // Decrease by 500
  },
  { new: true }
);
```

### Mark Notification as Read
```typescript
await Notification.updateMany(
  { userId, isRead: false },
  { isRead: true }
);
```

### Delete Transaction
```typescript
await Transaction.findByIdAndDelete(transactionId);
```

---

## Aggregation Examples

### Get Total Income vs Expense
```typescript
const summary = await Transaction.aggregate([
  {
    $match: {
      workspaceId,
      userId,
      date: {
        $gte: new Date(2026, 3, 1),
        $lt: new Date(2026, 4, 1),
      },
    },
  },
  {
    $group: {
      _id: "$type",
      total: { $sum: "$amount" },
    },
  },
]);
```

### Get Top Categories
```typescript
const topCategories = await Transaction.aggregate([
  {
    $match: {
      workspaceId,
      type: "expense",
      date: { $gte: startDate, $lte: endDate },
    },
  },
  {
    $group: {
      _id: "$categoryId",
      total: { $sum: "$amount" },
    },
  },
  { $sort: { total: -1 } },
  { $limit: 5 },
  {
    $lookup: {
      from: "categories",
      localField: "_id",
      foreignField: "_id",
      as: "category",
    },
  },
]);
```

---

## Helper Functions

### Validate ObjectId
```typescript
import { isValidObjectId, toObjectId } from "@/src/backend/utils/helpers";

if (!isValidObjectId(id)) {
  return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
}

const objectId = toObjectId(id); // Throws if invalid
```

### Sanitize Email
```typescript
import { sanitizeEmail } from "@/src/backend/utils/helpers";

const cleanEmail = sanitizeEmail("  John@EXAMPLE.com  ");
// Result: "john@example.com"
```

### Format Amount
```typescript
import { formatAmount } from "@/src/backend/utils/helpers";

const formatted = formatAmount(5000, "BDT");
// Result: "৳5,000.00"
```

### Paginate Results
```typescript
import { paginate } from "@/src/backend/utils/helpers";

const paginated = paginate(transactions, { page: 1, limit: 10 });
// Returns: { data, total, page, limit, totalPages, hasMore }
```

### Get Month Range
```typescript
import { getMonthDateRange } from "@/src/backend/utils/helpers";

const { start, end } = getMonthDateRange(4, 2026);
// start: April 1, 2026 00:00:00
// end: April 30, 2026 23:59:59
```

---

## Error Handling

### Duplicate Key Error
```typescript
try {
  await User.create(userData);
} catch (error: any) {
  if (error.code === 11000) {
    return NextResponse.json(
      { error: "Email already exists" },
      { status: 409 }
    );
  }
  throw error;
}
```

### Validation Error
```typescript
try {
  await User.create(userData);
} catch (error: any) {
  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    return NextResponse.json(
      { error: messages.join(", ") },
      { status: 400 }
    );
  }
  throw error;
}
```

### Not Found Error
```typescript
const user = await User.findById(userId);

if (!user) {
  return NextResponse.json(
    { error: "User not found" },
    { status: 404 }
  );
}
```

---

## Best Practices

1. **Always connect to MongoDB** before operations
   ```typescript
   await connectMongoDB();
   ```

2. **Exclude password** from user queries
   ```typescript
   User.findById(id).select("-password");
   ```

3. **Use population** for references
   ```typescript
   .populate("userId", "name email")
   ```

4. **Handle errors** gracefully
   ```typescript
   try { /* operation */ } 
   catch (error) { /* handle */ }
   ```

5. **Validate input** before database operations
   ```typescript
   if (!email || !password) { /* return error */ }
   ```

6. **Use transactions** for multi-document operations
   ```typescript
   const session = await mongoose.startSession();
   session.withTransaction(async () => {
     // Multiple operations
   });
   ```

7. **Index frequently queried fields** (already done in models)

8. **Limit query results** for pagination
   ```typescript
   .limit(10).skip((page - 1) * 10)
   ```

---

Last updated: April 3, 2026
