import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import companyRoutes from "./routes/company.routes.js";
import jobRoutes from "./routes/job.routes.js";
import applicationRoutes from "./routes/application.routes.js";
import candidateProfileRoutes from "./routes/candidateProfile.routes.js";
import savedJobRoutes from "./routes/savedJob.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import complaintRoutes from "./routes/complaint.routes.js";
import recruiterToolsRoutes from "./routes/recruiterTools.routes.js";
import resumeRoutes from "./routes/resume.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import recentlyViewedRoutes from "./routes/recentlyViewed.routes.js";
import { globalLimiter } from "./middlewares/limiters.js";
import { errorHandler } from "./middlewares/errorHandler.js";


const app=express();

const proxyHops = Number(process.env.TRUST_PROXY);
if (Number.isInteger(proxyHops) && proxyHops > 0) {
  app.set("trust proxy", proxyHops);
}

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    exposedHeaders: ["Retry-After", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "X-Cache"],
  })
);

app.use("/api", globalLimiter);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/candidates", candidateProfileRoutes);
app.use("/api/saved-jobs", savedJobRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/recruiter-tools", recruiterToolsRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/recently-viewed", recentlyViewedRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, ()=> {
    console.log(`Server is running on port ${PORT}`);
})