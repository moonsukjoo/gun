import express from "express";
import path from "path";
import nodemailer from "nodemailer";

const app = express();
const PORT = 3000;

// Set maximum request body sizes to accept large PDF or Excel Base64 payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Real Email sending API Endpoint
app.post("/api/send-email", async (req, res) => {
  const { to, subject, filename, base64Data } = req.body;

  if (!to || !filename || !base64Data) {
    return res.status(400).json({
      success: false,
      error: "전송에 필요한 필수 매개변수(to, filename, base64Data)가 누락되었습니다."
    });
  }

  // 1. Check if SMTP configuration is set up
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpSecure = process.env.SMTP_SECURE === "false" ? false : true;
  const smtpFrom = process.env.SMTP_FROM || `건명기업 스마트 안전 관리 <${smtpUser || "noreply@gmail.com"}>`;

  if (!smtpUser || !smtpPass) {
    console.error("SMTP Credentials are not configured in environment variables.");
    return res.status(400).json({
      success: false,
      error: "SMTP 연동 설정이 완료되지 않았습니다.",
      details: "AI Studio의 'Settings -> Secrets' 메뉴에서 SMTP_USER와 SMTP_PASS(Google 앱 비밀번호 등)를 추가하신 후 디바이스에서 다시 발송해 주세요."
    });
  }

  try {
    // 2. Setup Nomemailer Transport
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    // 3. Extract pure base64 data (in case data URI prefix exists)
    let cleanBase64 = base64Data;
    if (base64Data.includes(";base64,")) {
      cleanBase64 = base64Data.split(";base64,")[1];
    }

    const fileBuffer = Buffer.from(cleanBase64, "base64");

    const mailOptions = {
      from: smtpFrom,
      to: to,
      subject: subject || `[건명기업] 스마트 안전 관리 시스템 - ${filename}`,
      text: `안녕하세요. 건명기업 스마트 안전 관리 시스템입니다.\n\n요청하신 보고서 파일 [ ${filename} ]을 첨부하여 발송해 드립니다.\n\n감사합니다.\n- 건명기업 안전팀 드림.`,
      attachments: [
        {
          filename: filename,
          content: fileBuffer
        }
      ]
    };

    // 4. Send actual email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully: ", info.messageId);

    return res.json({
      success: true,
      messageId: info.messageId,
      message: "이메일 전송이 성공하였습니다."
    });
  } catch (error: any) {
    console.error("Failed to send email via SMTP:", error);
    return res.status(500).json({
      success: false,
      error: "메일 전송 실패",
      details: error.message || "서버 혹은 SMTP 설정에 문제가 발생했습니다."
    });
  }
});

// Serve health status
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Configure Vite or Static server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Force browser to never cache any source files or scripts in development
    app.use((req, res, next) => {
      const originalSetHeader = res.setHeader;
      res.setHeader = function (this: any, name: string, value: any) {
        if (name.toLowerCase() === "cache-control") {
          return originalSetHeader.call(this, name, "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
        }
        return originalSetHeader.call(this, name, value);
      };
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      next();
    });

    // Vite middleware for development
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
