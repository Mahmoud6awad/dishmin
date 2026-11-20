const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3000;
const dataDirectory = path.join(__dirname, "data");
const dataFile = path.join(dataDirectory, "staff.json");
const uploadDirectory = path.join(__dirname, "img", "staff");

fs.mkdirSync(dataDirectory, { recursive: true });
fs.mkdirSync(uploadDirectory, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]");

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(
      null,
      `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extension}`,
    );
  },
});
const upload = multer({
  storage,
  fileFilter: (_request, file, callback) => {
    callback(null, /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

function readStaff() {
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeStaff(staff) {
  fs.writeFileSync(dataFile, JSON.stringify(staff, null, 2));
}

function findStaff(id) {
  return readStaff().find((member) => member.id === id);
}

function renderPage(response, view, data = {}) {
  response.render(view, { ...data, currentPath: response.req.path });
}

app.get("/", (_request, response) => response.redirect("/dashboard"));

app.get("/dashboard", (request, response) => {
  const staff = readStaff().sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
  renderPage(response, "dashboard", { staff, totalStaff: staff.length });
});

app.get("/staff", (request, response) => {
  renderPage(response, "staff/index", { staff: readStaff() });
});

app.get("/staff/new", (request, response) => {
  renderPage(response, "staff/form", {
    staffMember: {},
    formTitle: "Add Staff Member",
    formAction: "/staff",
  });
});

app.post("/staff", upload.single("photo"), (request, response) => {
  const { name, job, address } = request.body;
  if (!name || !job || !address)
    return response
      .status(400)
      .render("error", {
        message: "Name, job, and address are required.",
        currentPath: "/staff",
      });
  const staff = readStaff();
  staff.push({
    id: crypto.randomUUID(),
    name: name.trim(),
    job: job.trim(),
    address: address.trim(),
    photo: request.file
      ? `/img/staff/${request.file.filename}`
      : "/img/user.jpg",
    createdAt: new Date().toISOString(),
  });
  writeStaff(staff);
  response.redirect("/staff");
});

app.get("/staff/:id", (request, response) => {
  const staffMember = findStaff(request.params.id);
  if (!staffMember)
    return response
      .status(404)
      .render("error", {
        message: "Staff member not found.",
        currentPath: "/staff",
      });
  renderPage(response, "staff/show", { staffMember });
});

app.get("/staff/:id/edit", (request, response) => {
  const staffMember = findStaff(request.params.id);
  if (!staffMember)
    return response
      .status(404)
      .render("error", {
        message: "Staff member not found.",
        currentPath: "/staff",
      });
  renderPage(response, "staff/form", {
    staffMember,
    formTitle: "Edit Staff Member",
    formAction: `/staff/${staffMember.id}/edit`,
  });
});

app.post("/staff/:id/edit", upload.single("photo"), (request, response) => {
  const staff = readStaff();
  const index = staff.findIndex((member) => member.id === request.params.id);
  if (index === -1)
    return response
      .status(404)
      .render("error", {
        message: "Staff member not found.",
        currentPath: "/staff",
      });
  const current = staff[index];
  const { name, job, address } = request.body;
  if (!name || !job || !address)
    return response
      .status(400)
      .render("error", {
        message: "Name, job, and address are required.",
        currentPath: "/staff",
      });
  staff[index] = {
    ...current,
    name: name.trim(),
    job: job.trim(),
    address: address.trim(),
    photo: request.file ? `/img/staff/${request.file.filename}` : current.photo,
  };
  writeStaff(staff);
  response.redirect(`/staff/${current.id}`);
});

app.get("/staff/:id/delete", (request, response) => {
  const staffMember = findStaff(request.params.id);
  if (!staffMember)
    return response
      .status(404)
      .render("error", {
        message: "Staff member not found.",
        currentPath: "/staff",
      });
  renderPage(response, "staff/delete", { staffMember });
});

app.post("/staff/:id/delete", (request, response) => {
  const staff = readStaff();
  const staffMember = staff.find((member) => member.id === request.params.id);
  if (!staffMember)
    return response
      .status(404)
      .render("error", {
        message: "Staff member not found.",
        currentPath: "/staff",
      });
  writeStaff(staff.filter((member) => member.id !== request.params.id));
  if (staffMember.photo.startsWith("/img/staff/")) {
    const uploadedPhoto = path.join(__dirname, staffMember.photo.substring(1));
    if (fs.existsSync(uploadedPhoto)) fs.unlinkSync(uploadedPhoto);
  }
  response.redirect("/staff");
});

app.listen(port, () =>
  console.log(`Staff dashboard running at http://localhost:${port}`),
);
