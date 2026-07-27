export interface HelpCategory {
  id: string;
  title: string;
  icon: string;
  isSubcategory?: boolean;
  parentCategoryId?: string;
}

export interface HelpArticle {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  planInfo?: string;
}

export const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started as a Vendor',
    icon: 'Rocket',
  },
  {
    id: 'features-plans',
    title: 'Features & Plans',
    icon: 'Package',
  },
  {
    id: 'payments',
    title: 'Payments',
    icon: 'CreditCard',
    isSubcategory: true,
    parentCategoryId: 'features-plans',
  },
  {
    id: 'orders',
    title: 'Orders',
    icon: 'Package',
    isSubcategory: true,
    parentCategoryId: 'features-plans',
  },
  {
    id: 'order-status-automation',
    title: 'Order Status & Automation',
    icon: 'Package',
    isSubcategory: true,
    parentCategoryId: 'features-plans',
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: 'Package',
    isSubcategory: true,
    parentCategoryId: 'features-plans',
  },
  {
    id: 'pickup-fulfillment',
    title: 'Pickup & Fulfillment',
    icon: 'Package',
    isSubcategory: true,
    parentCategoryId: 'features-plans',
  },
  {
    id: 'reports-sales',
    title: 'Reports & Sales',
    icon: 'Package',
    isSubcategory: true,
    parentCategoryId: 'features-plans',
  },
  {
    id: 'support-access',
    title: 'Support & Access',
    icon: 'Package',
    isSubcategory: true,
    parentCategoryId: 'features-plans',
  },
  {
    id: 'orders-custom',
    title: 'Orders & Custom Orders',
    icon: 'Package',
  },
  {
    id: 'payments-invoicing',
    title: 'Payments & Invoicing',
    icon: 'CreditCard',
  },
  {
    id: 'chat-communication',
    title: 'Chat & Customer Communication',
    icon: 'MessageSquare',
  },
  {
    id: 'safety-security',
    title: 'Safety & Account Security',
    icon: 'Shield',
  },
  {
    id: 'store-catalog',
    title: 'Store & Catalog',
    icon: 'Store',
  },
];

export const helpArticles: HelpArticle[] = [
  {
    id: 'does-the platform-process-payments',
    categoryId: 'payments',
    title: 'Does the platform process payments?',
    content: 'the platform does not process, hold, or move money.\n\nCustomers pay you directly using your own payment methods.',
    planInfo: 'All plans',
  },
  {
    id: 'manually-confirm-payment',
    categoryId: 'payments',
    title: 'What does manually confirm payment mean?',
    content: 'After receiving payment through your own method, you manually mark the order as paid inside the app.',
    planInfo: 'All plans',
  },
  {
    id: 'what-are-payment-requests',
    categoryId: 'payments',
    title: 'What are payment requests?',
    content: 'Payment requests allow you to send a payment request to a customer using your preferred payment method.',
    planInfo: 'Standard and above',
  },
  {
    id: 'partial-payments',
    categoryId: 'payments',
    title: 'Can I accept partial payments?',
    content: 'Partial payment support allows you to collect a deposit first and the remaining balance later.\n\nOrders can be restricted from completion until full payment is confirmed.',
    planInfo: 'Pro and Pro+',
  },
  {
    id: 'what-are-order-requests',
    categoryId: 'orders',
    title: 'What are order requests?',
    content: 'Order requests are orders sent by customers that require your approval before proceeding.\n\nYou can accept or decline each order.',
    planInfo: 'All plans',
  },
  {
    id: 'can-i-accept-decline-orders',
    categoryId: 'orders',
    title: 'Can I accept or decline orders?',
    content: 'Yes. Every order gives you the option to accept or decline it before proceeding.\n\nYou control which orders to fulfill.',
    planInfo: 'All plans',
  },
  {
    id: 'what-happens-decline-order',
    categoryId: 'orders',
    title: 'What happens when I decline an order?',
    content: 'When you decline an order, the customer is notified and the order is cancelled.\n\nYou can optionally provide a reason for declining.',
    planInfo: 'All plans',
  },
  {
    id: 'can-customers-send-custom-orders',
    categoryId: 'orders',
    title: 'Can customers send custom orders?',
    content: 'No, customers cannot create custom orders.\n\nOnly vendors can create custom orders for customers through the chat.',
    planInfo: 'All plans',
  },
  {
    id: 'can-i-disable-custom-orders',
    categoryId: 'orders',
    title: 'Can I disable custom orders?',
    content: 'Custom orders are a vendor-only feature.\n\nYou choose when to create custom orders. There is no setting to disable them.',
    planInfo: 'All plans',
  },
  {
    id: 'does-the platform-limit-orders',
    categoryId: 'orders',
    title: 'Does the platform limit how many orders I can accept?',
    content: 'the platform does not limit the number of orders you can accept on any plan.\n\nWe believe vendors should never be restricted from selling to their customers or growing their business. Your success should not be capped or slowed down by the platform you use.\n\nInstead of limiting orders, the platform\'s plans are based on how much automation and operational support you want, not how much you sell.\n\nThis means:\n- You can accept unlimited orders on all plans\n- You always control your revenue\n- Upgrades are optional and based on convenience, not pressure\n\nHigher plans exist to help reduce manual work — not to limit your growth.',
    planInfo: 'All plans',
  },
  {
    id: 'what-does-order-status-management-mean',
    categoryId: 'order-status-automation',
    title: 'What does order status management mean?',
    content: 'Order status management lets you track and update the state of each order (for example: pending, accepted, in progress, completed).\n\nAll plans include order status management.',
    planInfo: 'All plans',
  },
  {
    id: 'what-are-manual-status-updates',
    categoryId: 'order-status-automation',
    title: 'What are manual order status updates?',
    content: 'Manual status updates mean you update the order status yourself.\n\nYou control when orders move from one state to another (for example, from accepted to in progress).',
    planInfo: 'Basic, Standard',
  },
  {
    id: 'what-are-automatic-status-updates',
    categoryId: 'order-status-automation',
    title: 'What are automatic order status updates?',
    content: 'Automatic status updates mean order status changes automatically based on system rules.\n\nFor example, when payment is confirmed, the order moves to "in progress" automatically.',
    planInfo: 'Pro, Pro+',
  },
  {
    id: 'why-automatic-updates-plan-based',
    categoryId: 'order-status-automation',
    title: 'Why are automatic updates plan-based?',
    content: 'Automation features require additional system resources and logic.\n\nThey are included in Pro and Pro+ plans to support higher-volume vendors.',
    planInfo: 'Pro, Pro+',
  },
  {
    id: 'can-i-turn-automation-off',
    categoryId: 'order-status-automation',
    title: 'Can I turn automation off?',
    content: 'Yes. Automation features are optional.\n\nYou can disable auto-accept and automatic status updates in your settings.',
    planInfo: 'Pro, Pro+',
  },
  {
    id: 'does-the platform-track-inventory-automatically',
    categoryId: 'inventory',
    title: 'Does the platform track inventory automatically?',
    content: 'No. Inventory tracking is optional.\n\nYou can manually set quantities for items if you want to track stock levels.',
    planInfo: 'All plans (optional)',
  },
  {
    id: 'what-is-inventory-aware-automation',
    categoryId: 'inventory',
    title: 'What is inventory-aware automation?',
    content: 'Inventory-aware automation uses your stock levels to automatically control order handling.\n\nIf an item is out of stock, it can be marked unavailable automatically, and orders containing that item can be restricted from auto-accept.',
    planInfo: 'Pro+',
  },
  {
    id: 'what-happens-item-out-of-stock',
    categoryId: 'inventory',
    title: 'What happens when an item is out of stock?',
    content: 'When an item reaches zero quantity, it can be marked as unavailable.\n\nCustomers will not be able to add it to their order.',
    planInfo: 'All plans',
  },
  {
    id: 'can-customers-order-out-of-stock',
    categoryId: 'inventory',
    title: 'Can customers order out-of-stock items?',
    content: 'No. Items marked as unavailable or out of stock cannot be added to orders.\n\nCustomers can only order items marked as available.',
    planInfo: 'All plans',
  },
  {
    id: 'need-set-inventory-each-item',
    categoryId: 'inventory',
    title: 'Do I need to set inventory for each item?',
    content: 'No. Inventory tracking is optional.\n\nYou can choose which items to track or skip inventory entirely.',
    planInfo: 'All plans',
  },
  {
    id: 'how-does-pickup-work',
    categoryId: 'pickup-fulfillment',
    title: 'How does pickup work on the platform?',
    content: 'Customers place orders and pay directly to you.\n\nOnce payment is confirmed, you share pickup instructions (address, hours, special notes).\n\nCustomers pick up orders at your specified location.',
    planInfo: 'All plans',
  },
  {
    id: 'when-customers-receive-pickup-details',
    categoryId: 'pickup-fulfillment',
    title: 'When do customers receive pickup details?',
    content: 'Pickup details are sent after payment is confirmed.\n\nOn Pro and Pro+ plans, pickup instructions can be sent automatically if auto-send is enabled.',
    planInfo: 'All plans',
  },
  {
    id: 'can-change-pickup-instructions',
    categoryId: 'pickup-fulfillment',
    title: 'Can I change pickup instructions per order?',
    content: 'Yes. You can customize pickup instructions for each order if needed.\n\nDefault pickup details are saved in your settings.',
    planInfo: 'All plans',
  },
  {
    id: 'can-disable-pickup',
    categoryId: 'pickup-fulfillment',
    title: 'Can I disable pickup for my store?',
    content: 'Pickup is the primary fulfillment method on the platform.\n\nYou cannot disable pickup, but you can set custom pickup instructions or require delivery coordination.',
    planInfo: 'All plans',
  },
  {
    id: 'what-is-monthly-sales-summary',
    categoryId: 'reports-sales',
    title: 'What is the monthly sales summary?',
    content: 'The monthly sales summary shows your total sales, order count, and other key metrics for the current month.\n\nIt is generated from your completed orders.',
    planInfo: 'Standard and above',
  },
  {
    id: 'can-download-export-sales-reports',
    categoryId: 'reports-sales',
    title: 'Can I download or export sales reports?',
    content: 'Yes, on Pro and Pro+ plans.\n\nPro: Download monthly sales reports\nPro+: Download monthly and yearly sales reports',
    planInfo: 'Pro and Pro+',
  },
  {
    id: 'what-does-read-only-mean',
    categoryId: 'reports-sales',
    title: 'What does "read-only" mean?',
    content: '"Read-only" means you can view the sales summary on screen, but you cannot download or export it.\n\nThis applies to the Standard plan.',
    planInfo: 'Standard',
  },
  {
    id: 'which-plans-allow-report-exports',
    categoryId: 'reports-sales',
    title: 'Which plans allow report exports?',
    content: 'Pro and Pro+ plans allow report exports.\n\nPro: Monthly reports\nPro+: Monthly and yearly reports',
    planInfo: 'Pro and Pro+',
  },
  {
    id: 'how-often-reports-updated',
    categoryId: 'reports-sales',
    title: 'How often are reports updated?',
    content: 'Reports are updated in real time as orders are completed.\n\nYour sales summary reflects the most recent completed orders.',
    planInfo: 'Standard and above',
  },
  {
    id: 'how-contact-the platform-support',
    categoryId: 'support-access',
    title: 'How do I contact the platform support?',
    content: 'You can contact the platform support through the Help Center.\n\nTap "Contact Support" at the bottom of the Help Center page to submit a request.',
    planInfo: 'All plans',
  },
  {
    id: 'support-options-per-plan',
    categoryId: 'support-access',
    title: 'What support options are available per plan?',
    content: 'All plans: Standard email support\nPro+: Priority support with faster response times',
    planInfo: 'All plans',
  },
  {
    id: 'who-can-access-vendor-account',
    categoryId: 'support-access',
    title: 'Who can access my vendor account?',
    content: 'Only you can access your vendor account.\n\nthe platform does not support multi-user or team access at this time.',
    planInfo: 'All plans',
  },
  {
    id: 'how-secure-account',
    categoryId: 'support-access',
    title: 'How do I secure my account?',
    content: 'Use a strong, unique password.\n\nDo not share your login credentials.\n\nLog out when using shared devices.',
    planInfo: 'All plans',
  },
  {
    id: 'how-orders-work',
    categoryId: 'orders-custom',
    title: 'How orders work on the platform',
    content: `Understanding the order flow on the platform:

Before ordering
• Customers can message you before placing an order
• Answer questions and build trust
• Pre-order chat helps clarify details

Order types
• Standard orders: Customers add items from your catalog
• Custom orders: You create personalized orders for customers

Order visibility
• Orders appear in chat as preview cards
• Tap the preview to see full details
• Active orders appear in the pinned order summary at the top

Order lifecycle
• Pending → Accepted → In Progress → Ready → Completed
• You control order status changes
• Customers receive notifications at key stages`,
  },
  {
    id: 'send-custom-order',
    categoryId: 'orders-custom',
    title: 'How to send a custom order',
    content: `Custom orders let you create personalized orders for customers.

How to create a custom order:
1. Open a chat with a customer
2. Tap the "+" menu
3. Select "Create custom order"
4. Add items from your catalog
5. Adjust quantities and prices if needed
6. Add any special notes
7. Tap "Send for review"

What happens next:
• The custom order appears as a preview card in chat
• Customer taps "View custom order" to see details
• Customer can accept or decline
• You can edit the order before acceptance

Best practices:
• Be clear about pricing
• Include preparation time estimates
• Communicate any special requirements upfront`,
  },
  {
    id: 'vendor-payments',
    categoryId: 'payments-invoicing',
    title: 'How payments work for vendors',
    content: `Important: the platform does NOT collect or process payments.

Payment flow:
• You receive payments directly from customers
• the platform is not involved in the transaction
• You maintain full control over payment methods

How it works:
1. Customer places or accepts an order
2. You share payment instructions with the customer
3. Customer pays you directly (bank transfer, cash, etc.)
4. Customer confirms payment in chat
5. You verify payment and mark order as paid

Your responsibilities:
• Provide clear payment instructions
• Verify payments before fulfilling orders
• Keep accurate payment records
• Mark orders as paid manually

Supported payment methods:
• Bank transfer
• Cash on pickup
• Any method you specify in your payment instructions`,
  },
  {
    id: 'payment-instructions-safety',
    categoryId: 'payments-invoicing',
    title: 'Sharing payment instructions safely',
    content: `Keep payment requests professional and secure.

Best practices:
• Clearly state the total amount
• Specify accepted payment methods
• Include your business bank details if using transfers
• Set clear payment deadlines

Do NOT request:
• Sensitive customer information beyond what's necessary
• Payments to personal accounts unrelated to your business
• Upfront payments without order confirmation

Safety tips:
• Use the platform's built-in payment request feature
• Keep all payment communication in chat
• Only mark orders as paid after verifying payment
• Watch for fake payment confirmations

Red flags:
• Customers asking to pay via suspicious methods
• Overpayment followed by refund requests
• Pressure to fulfill orders before payment confirmation`,
  },
  {
    id: 'managing-multiple-orders',
    categoryId: 'orders-custom',
    title: 'Managing multiple orders',
    content: `Handle multiple customer orders efficiently.

Pinned order summary:
• Active orders appear in the pinned rail at the top of chat
• Scroll horizontally to view all active orders
• Tap any order to view full details
• Each order shows current status and key info

Order organization:
• Use the Orders tab to see all orders at once
• Filter by status: Pending, Active, Completed
• Each order maintains its own chat timeline
• Order numbers help track conversations

Best practices:
• Update order status promptly
• Avoid sending duplicate payment requests
• Keep each order's timeline clear
• Use order-specific chat to avoid confusion
• Set realistic fulfillment timeframes

Common mistakes:
• Mixing up orders between customers
• Forgetting to update order status
• Sending payment requests to wrong orders`,
  },
  {
    id: 'customer-communication',
    categoryId: 'chat-communication',
    title: 'Customer communication best practices',
    content: `Effective communication builds trust and repeat business.

Response time:
• Respond to messages promptly
• Set away messages if unavailable
• Use quick replies for common questions

Professional communication:
• Keep tone friendly but professional
• Be clear about pricing and timelines
• Set realistic expectations
• Follow through on commitments

Chat features:
• Use chat for all order-related communication
• Send catalog items to showcase products
• Share payment instructions directly in chat
• Use the order timeline as a record

Order-specific chats:
• Each order has its own chat thread
• Keep conversations relevant to that order
• Avoid mixing order discussions
• Order chat history is permanent

Customer privacy:
• Don't request unnecessary personal information
• Customer phone numbers are private
• Respect customer contact preferences
• Keep all communication professional`,
  },
  {
    id: 'security-fraud-prevention',
    categoryId: 'safety-security',
    title: 'Security & fraud prevention',
    content: `Protect your business from fraud and scams.

Payment fraud:
• Verify all payments before fulfilling orders
• Watch for fake payment confirmation screenshots
• Be suspicious of overpayments
• Never accept payment screenshot as proof alone

Common scams:
• Overpayment scams: Customer "accidentally" pays too much and asks for refund
• Fake confirmations: Edited screenshots of transfers
• Pressure tactics: Urgent requests to fulfill before verification
• Third-party payments: Someone else paying on behalf of customer

Red flags:
• Customer refusing to use standard payment methods
• Requests to fulfill orders before payment clears
• Suspicious urgency or pressure
• Requests to communicate outside the platform

Protect yourself:
• Always verify payments in your bank account
• Don't fulfill orders until payment is confirmed
• Keep all communication in the platform chat
• Report suspicious behavior immediately
• Trust your instincts

If something seems wrong:
• Pause the order
• Contact the platform support
• Do not proceed with fulfillment
• Document all suspicious interactions`,
  },
  {
    id: 'store-catalog-management',
    categoryId: 'store-catalog',
    title: 'Managing your store and catalog',
    content: `Keep your store organized and attractive.

Catalog organization:
• Organize items into categories
• Use clear, descriptive names
• Set accurate prices
• Include multiple photos per item
• Write detailed descriptions

Item images:
• Use high-quality photos
• Show the actual product
• Use consistent lighting and backgrounds
• Primary image appears in catalog previews
• Add multiple angles if relevant

Pricing:
• Set clear, honest prices
• Update prices regularly
• Consider offering discounts or promotions
• Be transparent about any additional fees

Availability:
• Mark items as unavailable when out of stock
• Update business hours regularly
• Set store status to "Closed" when not operating
• Use away messages during off hours

Store appearance:
• Add a professional cover photo
• Write a clear business description
• Complete all profile information
• Keep pickup details updated`,
  },
  {
    id: 'verification-trust',
    categoryId: 'getting-started',
    title: 'Verification & Trust',
    content: `Why we require verification

Verification helps build trust between vendors and customers on the platform. Verified vendors appear in Home, Explore, and Search — giving them full visibility to new customers browsing the marketplace.

Unverified vendors can still receive orders by sharing their storefront link directly, but they will not appear in discovery surfaces until verification is complete.

What information is collected

During verification, you will be asked to provide:
• A government-issued ID (passport, national ID, or driver's license)
• A selfie or liveness check to confirm your identity matches the ID

No payment or financial information is collected during this process.

What happens if you don't verify

If you choose not to complete verification:
• Your storefront will not appear in Home, Explore, or Search
• New customers browsing the marketplace will not find you
• You can still accept orders from customers you share your link with directly
• Your existing customers will not be affected

How long verification takes

The identity verification process typically takes 2–5 minutes to complete. After submission, review is usually instant. In some cases, manual review may be required and can take up to 24–48 hours.

Data privacy and security

Your identity documents are processed securely and are never stored on the platform's servers beyond what is required for the verification review. We use industry-standard encryption and work with trusted verification partners to protect your data. Your personal information is never shared with customers or third parties.`,
  },
  {
    id: 'setup-vendor-store',
    categoryId: 'getting-started',
    title: 'Getting started as a vendor',
    content: `Welcome to the platform! Set up your vendor account:

1. Complete your business profile
• Add your business name and description
• Upload a professional logo
• Add a cover photo
• Set your business category

2. Build your catalog
• Create product categories
• Add your first items
• Upload high-quality photos
• Set prices and descriptions

3. Configure payment methods
• Go to Settings → Payments
• Add bank account details for transfers
• Set up payment instructions
• Enable payment methods you accept

4. Set up order fulfillment
• Add pickup location and instructions
• Configure business hours
• Set minimum order amounts if needed
• Enable auto-accept if desired

5. Go live
• Toggle your store status to "Open"
• Start receiving customer messages
• Accept your first orders

Need help? Visit the Help Center anytime.`,
  },
  {
    id: 'order-statuses-explained',
    categoryId: 'orders-custom',
    title: 'Order statuses explained',
    content: `Understanding order statuses:

Pending
• Customer submitted an order
• Waiting for your review
• You need to accept or decline

Accepted
• You accepted the order
• Waiting for customer payment
• Share payment instructions

In Progress
• Payment confirmed
• Order is being prepared
• Keep customer updated on progress

Ready for Pickup
• Order is complete and ready
• Customer notified
• Pickup details shared

Completed
• Order successfully fulfilled
• Customer picked up the order
• Order is now closed

Cancelled
• Order was cancelled
• Can be cancelled by you or customer
• Include reason for cancellation`,
  },

];
