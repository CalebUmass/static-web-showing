# 🌐 Poggio Civitate – Static Project Website

This static website serves as a central hub for showcasing digital projects created by the 2025 Poggio Civitate archaeological field school. It is hosted on an AWS Lightsail instance and served via Apache using the Bitnami stack.

---

## 🧱 Purpose

The site provides a clean and accessible platform for students, researchers, and visitors to explore archaeological reconstructions, trench books, maps, 3D models (soon), and other digital tools created during the excavation season.

---

## 🚀 Features

- 🗂️ Central landing page linking to all student and collaborative digital projects  
- 📖 Trench Book Viewer to explore scanned notebooks  
- 🧮 Coordinate Converter that transforms site grid coordinates into WGS84 and EPSG:32633  
- 🧭 Interactive maps and models (planned or integrated)  
- ⚡ Fast, static deployment using Apache  
- 🔒 Optionally secured with HTTPS using Let’s Encrypt  

---

## 📁 Directory Structure

```

/static-web-showing
├── Projects-Landing-Page-main/  # Main landing page for all projects
|
├── trench-book-reader/  # Project 1
├── projected-coordinates-project-copy  # Project 2        
├── other-projects/       # Additional student projects can be added here
└── README.md
```

---

## 🔧 Deployment Instructions

1. **SSH into your Lightsail server:**
   ```bash
   ssh -i ~<WhereeverLightsailKeyIsOnDisc> bitnami@<server-ip>
   ```

2. **Navigate to the web root:**
   ```bash
   cd /opt/bitnami/apache2/htdocs
   ```

3. **Clone or update the repository:**
   ```bash
   git clone https://github.com/yourusername/static-web-showing.git
   ```
---

## 🧠 Notes

- This site is designed to be extended with more projects each season.
- Future improvements may include dynamic search, offline support, or an image caching services.

---

## 👥 Contributors

- **Add each of our names with projects + everyone who helped with this process

---

## 📜 License

MIT License (or specify another license if needed)

---

## 📸 Screenshot (soon)

_Add a screenshot here if available:_

```html
![Site Screenshot](./screenshot.jpg)
```
