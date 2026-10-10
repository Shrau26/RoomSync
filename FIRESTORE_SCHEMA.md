# RoomSync — Firestore Schema (Referral System)

## Collection: `users`

Each document ID = Firebase Auth UID.

```
users/{uid}
  uid:               string   — Firebase Auth UID
  name:              string   — full name
  email:             string
  role:              string   — "student_need_room" | "student_have_room" | "owner"
  referralCode:      string   — e.g. "SHRAVANI4821" (auto-generated on signup)
  referredBy?:       string   — UID of the owner who referred this student
                               (only present if a referral code was used at signup)
                               BrowseRoomsPage uses this to restrict listings to that owner only.
  college:           string
  year:              string
  budget:            { min: number, max: number }
  sleep_schedule:    string
  study_type:        string
  cleanliness:       number
  profile_image_url: string
  created_at:        Timestamp
```

**referralCode** format: `FIRSTNAME` (uppercase, max 12 chars) + 4 random digits.
Example: `generateReferralCode("Shravani Patil")` → `"SHRAVANI4821"`

---

## Collection: `referrals`

Created when a new user signs up using someone else's referral code.

```
referrals/{autoId}
  referrerId:      string   — UID of the user who shared the code
  referredUserId:  string   — UID of the newly registered user
  referredEmail:   string   — email of the new user (shown in ReferralPage)
  status:          string   — "registered" | "booked" | "moved_in" | "completed"
  commission:      number   — 0 until completed, then 1000
  createdAt:       Timestamp
  bookedAt?:       Timestamp  — set when referredUser schedules a visit
  movedInAt?:      Timestamp  — set when owner clicks "Mark as Moved In"
  completedAt?:    Timestamp  — set when owner clicks "Confirm & Pay ₹1,000"
```

### Status lifecycle:
```
  registered  →  booked  →  moved_in  →  completed
  (signup)       (visit    (owner marks  (owner confirms
                scheduled)  moved in)    move-in → ₹1000)
```

**Validations enforced by `referralService.js`:**
- No self-referral (referrerId !== referredUserId)
- One referral per user (referredUserId is unique across the collection)
- Code must exist in `users` collection with matching `referralCode` field
- Each stage only advances forward — `moved_in` requires `booked`, `completed` requires `moved_in`

---

## Collection: `visits`

```
visits/{autoId}
  student_uid:   string   — ← used to find the referral document
  student_name:  string
  student_email: string
  owner_uid:     string
  room_id:       string
  room_title:    string
  date:          string
  time:          string
  status:        string   — "pending" | "confirmed" | "declined" | "cancelled"
  created_at:    Timestamp
  confirmed_at?: Timestamp
```

**Referral hooks:**
- `addDoc(visits)` → calls `markReferralBooked(student_uid)` → sets referral `status = "booked"`
- Owner clicks **Mark as Moved In** → calls `markReferralMovedIn(student_uid)` → sets `status = "moved_in"`
- Owner clicks **Confirm & Pay ₹1,000** → calls `markReferralCompleted(student_uid)` → sets `status = "completed"`, `commission = 1000`

---

## Firestore Security Rules (add to firestore.rules)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own profile
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }

    // Referrals: referrer can read their own; system can create
    match /referrals/{refId} {
      allow read:   if request.auth != null
                    && request.auth.uid == resource.data.referrerId;
      allow create: if request.auth != null
                    && request.resource.data.referredUserId == request.auth.uid;
      allow update: if request.auth != null;  // tighten in production
    }

    // Visits: student or owner can access
    match /visits/{visitId} {
      allow read, write: if request.auth != null
                         && (request.auth.uid == resource.data.student_uid
                             || request.auth.uid == resource.data.owner_uid);
      allow create: if request.auth != null;
    }
  }
}
```


## Collection: `users`

Each document ID = Firebase Auth UID.

```
users/{uid}
  uid:               string   — Firebase Auth UID
  name:              string   — full name
  email:             string
  role:              string   — "student_need_room" | "student_have_room" | "owner"
  referralCode:      string   — e.g. "SHRAVANI4821" (auto-generated on signup)
  college:           string
  year:              string
  budget:            { min: number, max: number }
  sleep_schedule:    string
  study_type:        string
  cleanliness:       number
  profile_image_url: string
  created_at:        Timestamp
```

**referralCode** format: `FIRSTNAME` (uppercase, max 12 chars) + 4 random digits.
Example: `generateReferralCode("Shravani Patil")` → `"SHRAVANI4821"`

---

## Collection: `referrals`

Created when a new user signs up using someone else's referral code.

```
referrals/{autoId}
  referrerId:      string   — UID of the user who shared the code
  referredUserId:  string   — UID of the newly registered user
  referredEmail:   string   — email of the new user (shown in ReferralPage)
  status:          string   — "registered" | "booked" | "completed"
  commission:      number   — 0 until completed, then 1000
  createdAt:       Timestamp
  bookedAt?:       Timestamp  — set when referredUser schedules a visit
  completedAt?:    Timestamp  — set when owner confirms the visit
```

### Status lifecycle:
```
  registered  →  booked  →  completed
  (signup)       (visit      (owner
                  scheduled)  confirms)
```

**Validations enforced by `referralService.js`:**
- No self-referral (referrerId !== referredUserId)
- One referral per user (referredUserId is unique across the collection)
- Code must exist in `users` collection with matching `referralCode` field

---

## Collection: `visits`

Unchanged from before — but now triggers referral status updates.

```
visits/{autoId}
  student_uid:   string   — ← used to find the referral document
  student_name:  string
  student_email: string
  owner_uid:     string
  room_id:       string
  room_title:    string
  date:          string
  time:          string
  status:        string   — "pending" | "confirmed" | "declined" | "cancelled"
  created_at:    Timestamp
  confirmed_at?: Timestamp
```

**Referral hooks:**
- `addDoc(visits)` → calls `markReferralBooked(student_uid)` → sets referral `status = "booked"`
- Owner confirms → calls `markReferralCompleted(student_uid)` → sets `status = "completed"`, `commission = 1000`

---

## Firestore Security Rules (add to firestore.rules)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own profile
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }

    // Referrals: referrer can read their own; system can create
    match /referrals/{refId} {
      allow read:   if request.auth != null
                    && request.auth.uid == resource.data.referrerId;
      allow create: if request.auth != null
                    && request.resource.data.referredUserId == request.auth.uid;
      allow update: if request.auth != null;  // tighten in production
    }

    // Visits: student or owner can access
    match /visits/{visitId} {
      allow read, write: if request.auth != null
                         && (request.auth.uid == resource.data.student_uid
                             || request.auth.uid == resource.data.owner_uid);
      allow create: if request.auth != null;
    }
  }
}
```
