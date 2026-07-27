export interface CustomerHelpCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
}

export interface CustomerHelpArticle {
  id: string;
  categoryId: string;
  title: string;
  content: string;
}

export const customerHelpCategories: CustomerHelpCategory[] = [
  { id: 'getting-started', title: 'Getting Started', icon: 'Rocket', description: 'Set up your account and explore the platform' },
  { id: 'finding-vendors', title: 'Finding Vendors', icon: 'Search', description: 'Discover and explore vendor stores' },
  { id: 'ordering', title: 'Ordering', icon: 'ShoppingBag', description: 'Place and manage your orders' },
  { id: 'custom-orders', title: 'Custom Orders', icon: 'Sparkles', description: 'Receive personalized order proposals' },
  { id: 'payments-safety', title: 'Payments & Safety', icon: 'CreditCard', description: 'How payments work and staying safe' },
  { id: 'messaging-vendors', title: 'Messaging Vendors', icon: 'MessageSquare', description: 'Chat safely with vendors' },
  { id: 'order-status', title: 'Order Status', icon: 'PackageCheck', description: 'Track your orders through each stage' },
  { id: 'contact-cards', title: 'Contact Cards', icon: 'Contact', description: 'Share contact details privately' },
  { id: 'favorites', title: 'Favorites', icon: 'Heart', description: 'Save vendors and items you love' },
  { id: 'privacy-security', title: 'Privacy & Security', icon: 'Lock', description: 'Manage your data and account safety' },
  { id: 'reporting-problem', title: 'Reporting a Problem', icon: 'Flag', description: 'Report issues or suspicious activity' },
  { id: 'account-support', title: 'Account Support', icon: 'LifeBuoy', description: 'Get help from the the platform team' },
];

export const customerHelpArticles: CustomerHelpArticle[] = [
  {
    id: 'welcome-to-the platform',
    categoryId: 'getting-started',
    title: 'Welcome to the platform',
    content: `the platform connects you with local vendors so you can browse their stores, chat before ordering, and place orders directly.

## Getting set up
• Complete your profile so vendors can recognize you
• Set your location to discover vendors near you
• Browse the home and explore screens to find stores

## What you can do
• Order items directly from vendor catalogs
• Receive custom order proposals from vendors
• Message vendors before and during an order
• Save your favorite vendors and items for later`,
  },
  {
    id: 'setting-your-location',
    categoryId: 'getting-started',
    title: 'Setting your location',
    content: `Your location helps the platform show you vendors in your area.

## How to set it
• Open Settings and tap Location
• Choose your country, region, and area
• Your home screen updates to show nearby vendors

If no area is selected, the platform shows vendors based on your region instead. You can update your location anytime.`,
  },
  {
    id: 'finding-and-browsing-vendors',
    categoryId: 'finding-vendors',
    title: 'Finding and browsing vendors',
    content: `Discover vendors that match what you are looking for.

## Ways to find vendors
• Browse the home screen for featured and nearby stores
• Use Explore to see vendors by category
• Search by name or what you need

## On a vendor store
• View their catalog, prices, and descriptions
• See their business hours and pickup details
• Tap any item to view full details before ordering`,
  },
  {
    id: 'why-some-vendors-appear',
    categoryId: 'finding-vendors',
    title: 'Why some vendors appear and others do not',
    content: `Vendors shown in Home, Explore, and Search are active stores that are open to new customers.

If a vendor shared a store link with you directly, you can still open their store and order even if they do not appear in browse and search. Saving them to your Favorites makes it easy to find them again.`,
  },
  {
    id: 'how-ordering-works',
    categoryId: 'ordering',
    title: 'How ordering works',
    content: `## Browse vendor stores
Each vendor has their own storefront with catalog items, prices, and descriptions. Explore different categories and view detailed product information.

## Message before ordering
You can message vendors before placing an order to ask questions, clarify details, or discuss requests. Pre-order chat helps you make informed decisions.

## Standard orders vs custom orders
• Standard orders: add items from the vendor's catalog to your cart, choose quantity, and check out
• Custom orders: vendors create personalized proposals for you that appear in chat as preview cards

## Orders appear in chat
When you place an order or receive a proposal, it appears in your chat with the vendor as a preview card. Tap it to see full details, track status, and communicate about the order.`,
  },
  {
    id: 'placing-an-order',
    categoryId: 'ordering',
    title: 'Placing an order',
    content: `## Add items to your cart
Open a vendor store, choose the items you want, set quantities, and add them to your cart.

## Review and submit
• Check your items and the estimated total
• Add any notes for the vendor
• Submit your order for the vendor to review

## What happens next
Your order starts as Pending while the vendor reviews it. They can accept or decline, and you will be notified either way.`,
  },
  {
    id: 'what-is-a-custom-order',
    categoryId: 'custom-orders',
    title: 'What is a custom order?',
    content: `A custom order is a personalized order proposal a vendor creates for you — useful for items that are not in their catalog or that need special customization.

## How custom orders work
1. You message a vendor about a custom item or service
2. After discussing your needs, the vendor creates a proposal
3. You receive the proposal in chat as a preview card
4. You review the items, quantities, and total
5. You accept or decline the proposal

## Custom order preview cards
• Number of items in the order
• Estimated total cost
• A "View custom order" button

## Accepting a custom order
When you accept, it becomes an active order and follows the standard order lifecycle.`,
  },
  {
    id: 'how-payment-works',
    categoryId: 'payments-safety',
    title: 'How payment works',
    content: `the platform does not receive, hold, or process customer payments.

## Direct payment
All payments happen directly between you and the vendor, outside of the the platform app. The vendor sends you payment instructions when it is time to pay.

## Payment safety tips
• Only pay after the vendor accepts your order
• Use secure payment methods with buyer protection where possible
• Never share banking credentials or passwords
• Keep proof of payment such as screenshots or receipts
• Report suspicious payment requests immediately`,
  },
  {
    id: 'payment-red-flags',
    categoryId: 'payments-safety',
    title: 'Payment red flags to watch for',
    content: `Stay alert to avoid scams.

## Red flags
• Vendors asking for payment before accepting your order
• Requests to pay outside normal methods
• Pressure to pay immediately without details
• Payment amounts that do not match your order

## If something goes wrong
Contact the vendor first to resolve payment issues. If you cannot reach a resolution, report the issue to the platform Support.`,
  },
  {
    id: 'messaging-vendors-safely',
    categoryId: 'messaging-vendors',
    title: 'Messaging vendors safely',
    content: `## Keep communication in-app
Always communicate with vendors through the platform's chat. This keeps a record of your conversations and protects both parties.

## Safe to share
• Order details and preferences
• Delivery addresses when ordering
• Contact cards for order fulfillment
• Payment confirmation details

## Never share
• Banking passwords or PINs
• Full credit card numbers
• Government ID numbers
• Social security or national ID

## Red flags in chat
• Requests to move the conversation off-platform
• Asking for sensitive personal information
• Pressure tactics or urgent demands
• Requests for payment before order acceptance

## If you feel unsafe
You can block a vendor or report suspicious behavior at any time.`,
  },
  {
    id: 'order-statuses-explained',
    categoryId: 'order-status',
    title: 'Order statuses explained',
    content: `Orders move through several stages. Here is what each one means.

## Pending
Your order has been submitted and is waiting for the vendor to review and accept it.

## Accepted
The vendor accepted your order and will begin preparing it. Track progress and chat in the order thread.

## In progress
Your order is being actively prepared. Payment instructions may be shared during this stage.

## Completed
Your order is ready for pickup or has been fulfilled. The order chat stays accessible for a short time afterward.

## Cancelled
The order was cancelled by you or the vendor. If payment was made, coordinate any refund directly with the vendor.`,
  },
  {
    id: 'what-are-contact-cards',
    categoryId: 'contact-cards',
    title: 'What are contact cards?',
    content: `Contact cards are a private way to share contact details such as a phone number with a vendor during an order.

## View-once behavior
• The vendor can only view the card once
• After viewing, it becomes a blurred placeholder
• The vendor cannot re-open the contact details

## Expiration after the order
Contact cards expire when an order is completed or cancelled. After that, the card becomes permanently inaccessible.

## Screenshot protection
Screenshots are disabled when viewing a contact card for an extra layer of privacy. Only share contact details with vendors you trust.`,
  },
  {
    id: 'using-saved-contact-cards',
    categoryId: 'contact-cards',
    title: 'Using saved contact cards',
    content: `You can save your most-used delivery and pickup details for faster checkout.

## How it works
• Saved contact cards are stored locally on your device
• They cannot be screenshotted
• Send one to a vendor when contact details are needed for fulfillment

## Best practices
Only include the details needed for the order, and only share when necessary for fulfillment.`,
  },
  {
    id: 'saving-favorites',
    categoryId: 'favorites',
    title: 'Saving favorites',
    content: `Keep the vendors and items you love within easy reach.

## How to save
• Tap the heart on a vendor store or an item to add it to Favorites
• Open the Favorites screen to see everything you saved
• Switch between saved vendors and saved items using the tabs

## Why use favorites
• Quickly reorder from vendors you trust
• Keep track of items you want to buy later
• Find vendors again even if they are not in browse`,
  },
  {
    id: 'managing-privacy',
    categoryId: 'privacy-security',
    title: 'Managing your privacy',
    content: `You control what you share on the platform.

## Your data
• Review the Privacy & Data screen in Settings
• Your phone number stays private unless you choose to share it
• Contact cards let you share details privately and temporarily

## Account safety
• Use a strong, unique password
• Do not share your login details
• Log out on shared devices

## Blocking
Blocking a vendor stops them from contacting you. You can manage blocked vendors in your settings at any time.`,
  },
  {
    id: 'reporting-a-problem',
    categoryId: 'reporting-problem',
    title: 'Reporting a problem',
    content: `## When to report
• A vendor violates the platform policies
• You experience harassment or abuse
• Payment fraud or scam attempts occur
• Inappropriate content is shared
• A vendor misuses your contact information

## How to report a vendor
1. Open the vendor's profile page
2. Tap the menu icon
3. Select "Report Vendor"
4. Choose the reason for reporting
5. Provide details about the issue
6. Submit your report

## Reporting vs blocking
• Blocking prevents the vendor from contacting you but does not notify the platform
• Reporting alerts the platform to policy violations and helps protect other customers

## Urgent issues
If you are in immediate danger, contact local authorities first, then report to the platform Support.`,
  },
  {
    id: 'contact-support',
    categoryId: 'account-support',
    title: 'Contacting support',
    content: `Our team is here to help with account and order questions.

## How to reach us
• Use the Contact Support option in the Help Center
• Describe your issue with as much detail as possible
• Include order details if your question is about a specific order

## Response times
We aim to respond as quickly as possible. For account access issues, include the email associated with your account.`,
  },
  {
    id: 'managing-your-account',
    categoryId: 'account-support',
    title: 'Managing your account',
    content: `Keep your account details up to date.

## Profile
• Update your name and photo from the Profile screen
• Your display name is how vendors see you

## Sign out
You can sign out from Settings at any time. For password or login help, contact the platform Support.`,
  },
];
