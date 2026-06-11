require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Trip = require("./models/Trip");
const Message = require("./models/Message");
const Notification = require("./models/Notification");

const MONGO = process.env.MONGODB_URI || "mongodb://localhost:27017/travelshare";

const DEMO_USERS = [
  { name: "Soumyadip Pal", email: "soumyadip@demo.com", phone: "9876543210", password: "demo12345", gender: "Male", city: "Kolkata", trust: 92, conversation: "friendly" },
  { name: "Rohit Paul", email: "rohit@demo.com", phone: "9876543211", password: "demo12345", gender: "Male", city: "Kolkata", trust: 88, conversation: "quiet" },
  { name: "Saptarshi Ghosh", email: "saptarshi@demo.com", phone: "9876543212", password: "demo12345", gender: "Male", city: "Delhi", trust: 94, conversation: "friendly" },
  { name: "Priya Sharma", email: "priya@demo.com", phone: "9876543213", password: "demo12345", gender: "Female", city: "Mumbai", trust: 90, conversation: "quiet" },
  { name: "Ananya Roy", email: "ananya@demo.com", phone: "9876543214", password: "demo12345", gender: "Female", city: "Kolkata", trust: 96, conversation: "friendly" },
  { name: "Jitendrio Saha", email: "jitendrio@demo.com", phone: "9876543215", password: "demo12345", gender: "Male", city: "Bengaluru", trust: 86, conversation: "quiet" },
];

const KOLKATA_ROUTES = [
  { originAddr: "Salt Lake Sector V", oLat: 22.5726, oLng: 88.4145, destAddr: "Park Street", dLat: 22.5514, dLng: 88.3517 },
  { originAddr: "Dum Dum Airport", oLat: 22.6532, oLng: 88.4463, destAddr: "New Town Rajarhat", dLat: 22.5826, dLng: 88.4839 },
  { originAddr: "Howrah Station", oLat: 22.5839, oLng: 88.3421, destAddr: "Salt Lake City", dLat: 22.5726, dLng: 88.4145 },
  { originAddr: "Esplanade", oLat: 22.5626, oLng: 88.3503, destAddr: "Jadavpur", dLat: 22.4997, dLng: 88.3720 },
  { originAddr: "Behala", oLat: 22.4983, oLng: 88.3030, destAddr: "Tollygunge", dLat: 22.4973, dLng: 88.3510 },
];

async function seed() {
  await mongoose.connect(MONGO);
  console.log("Connected to MongoDB");

  await Promise.all([
    User.deleteMany({ email: { $in: DEMO_USERS.map((u) => u.email) } }),
    Trip.deleteMany({ city: { $in: ["Kolkata", "Delhi", "Mumbai", "Bengaluru"] } }),
    Message.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  const users = [];
  for (const demo of DEMO_USERS) {
    const user = new User({
      ...demo,
      role: demo.email === "soumyadip@demo.com" ? "admin" : "rider",
      isVerified: true,
      emergencyContact: { name: "Trusted Contact", phone: "9000000000" },
      trustScore: { score: demo.trust, rideCompletion: 0.96, cancellationRate: 0.04, complaints: 0, onTimeRate: 0.95, safeDriving: 1 },
      rideMood: { conversation: demo.conversation, music: "any", ac: "any", safeDriving: true },
      wallet: { balance: demo.trust > 90 ? 80 : 25, compensationCredits: 0 },
    });
    await user.save();
    users.push(user);
  }
  console.log(`Created ${users.length} demo users`);

  const kolUsers = users.filter((u) => u.city === "Kolkata");
  const now = new Date();
  const trips = [
    {
      host: kolUsers[0]._id,
      tripType: "live",
      origin: { lat: KOLKATA_ROUTES[0].oLat, lng: KOLKATA_ROUTES[0].oLng, address: KOLKATA_ROUTES[0].originAddr },
      destination: { lat: KOLKATA_ROUTES[0].dLat, lng: KOLKATA_ROUTES[0].dLng, address: KOLKATA_ROUTES[0].destAddr },
      departureTime: new Date(now.getTime() + 15 * 60000),
      totalSeats: 3,
      availableSeats: 2,
      actualFare: 220,
      genderPreference: "Any",
      city: "Kolkata",
      rideMood: { conversation: "friendly", music: "low", ac: "on", safeDriving: true },
      status: "active",
    },
    {
      host: kolUsers[1]._id,
      tripType: "need_partner",
      origin: { lat: KOLKATA_ROUTES[1].oLat, lng: KOLKATA_ROUTES[1].oLng, address: KOLKATA_ROUTES[1].originAddr },
      destination: { lat: KOLKATA_ROUTES[1].dLat, lng: KOLKATA_ROUTES[1].dLng, address: KOLKATA_ROUTES[1].destAddr },
      departureTime: new Date(now.getTime() + 30 * 60000),
      totalSeats: 2,
      availableSeats: 1,
      genderPreference: "Any",
      city: "Kolkata",
      rideMood: { conversation: "quiet", music: "none", ac: "any", safeDriving: true },
      status: "active",
    },
  ];

  for (let i = 2; i < KOLKATA_ROUTES.length; i += 1) {
    const route = KOLKATA_ROUTES[i];
    trips.push({
      host: users[i % users.length]._id,
      tripType: "scheduled",
      origin: { lat: route.oLat, lng: route.oLng, address: route.originAddr },
      destination: { lat: route.dLat, lng: route.dLng, address: route.destAddr },
      departureTime: new Date(now.getTime() + (i * 2 + 1) * 60 * 60000),
      totalSeats: 3,
      availableSeats: 3,
      genderPreference: i % 3 === 0 ? "Female" : "Any",
      city: "Kolkata",
      distanceKm: 6 + i * 1.5,
      durationMin: 20 + i * 4,
      rideMood: { conversation: i % 2 ? "quiet" : "friendly", music: "any", ac: "on", safeDriving: true },
      predictedFare: { lower: 130 + i * 20, median: 165 + i * 20, upper: 200 + i * 20, perPerson: Math.ceil((165 + i * 20) / 3), modelUsed: "seed" },
      status: "active",
    });
  }

  const createdTrips = await Trip.insertMany(trips);
  const firstTrip = createdTrips[0];
  firstTrip.passengers.push({ user: kolUsers[1]._id, status: "accepted" });
  firstTrip.availableSeats = 1;
  await firstTrip.save();

  await Message.insertMany([
    { trip: firstTrip._id, sender: kolUsers[0]._id, text: "I am heading from Salt Lake to Park Street. Want to share the cab?" },
    { trip: firstTrip._id, sender: kolUsers[1]._id, text: "Yes. Where should I meet you?" },
    { trip: firstTrip._id, sender: kolUsers[0]._id, text: "Sector V Metro gate works." },
  ]);

  console.log(`Created ${createdTrips.length} demo trips`);
  console.log("Demo Login Credentials:");
  DEMO_USERS.forEach((u) => console.log(`  ${u.email} / ${u.password} (${u.city})`));

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
