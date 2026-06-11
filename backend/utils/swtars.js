const Trip = require("../models/Trip");
const { createNotification } = require("./notifications");

async function processWaitingRequests(io) {
  const now = new Date();
  const trips = await Trip.find({
    status: "active",
    "swtars.autoCancellationEnabled": true,
    passengers: {
      $elemMatch: {
        status: "pending",
        autoCancelAt: { $lte: now },
      },
    },
  }).limit(25);

  for (const trip of trips) {
    const expired = trip.passengers.filter((p) => p.status === "pending" && p.autoCancelAt && p.autoCancelAt <= now);
    if (!expired.length) continue;

    expired.forEach((entry) => {
      entry.status = "rejected";
    });

    if (trip.swtars.autoRebookingEnabled) {
      trip.dacs.reassignmentStatus = "queued";
    }
    await trip.save();

    io?.to(`trip_${trip._id}`).emit("passenger_updated", {
      tripId: trip._id,
      action: "auto_cancelled",
    });

    for (const entry of expired) {
      await createNotification({
        io,
        userId: entry.user,
        type: "trip",
        title: "Request auto-cancelled",
        message: "The host did not respond in time. Rebooking has been queued.",
        data: { tripId: trip._id, reassignmentStatus: trip.dacs.reassignmentStatus },
      });
    }
  }

  return trips.length;
}

function startSwtarsWorker(io) {
  const intervalMs = Number(process.env.SWTARS_INTERVAL_MS || 60000);
  const timer = setInterval(() => {
    processWaitingRequests(io).catch((err) => {
      console.error("[SWTARS] worker failed:", err.message);
    });
  }, intervalMs);

  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { processWaitingRequests, startSwtarsWorker };
