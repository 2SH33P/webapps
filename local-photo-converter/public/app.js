const elements = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  formatSelect: document.getElementById("formatSelect"),
  qualityRange: document.getElementById("qualityRange"),
  qualityCard: document.querySelector(".quality-card"),
  qualityValue: document.getElementById("qualityValue"),
  qualityHint: document.getElementById("qualityHint"),
  convertBtn: document.getElementById("convertBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  statusText: document.getElementById("statusText"),
  sourcePreview: document.getElementById("sourcePreview"),
  resultPreview: document.getElementById("resultPreview"),
  sourcePlaceholder: document.getElementById("sourcePlaceholder"),
  resultPlaceholder: document.getElementById("resultPlaceholder"),
  sourceMeta: document.getElementById("sourceMeta"),
  resultMeta: document.getElementById("resultMeta"),
  resultTitle: document.getElementById("resultTitle"),
}

const formats = {
  webp: {
    mimeType: "image/webp",
    extension: "webp",
    label: "WebP",
    usesQuality: true,
    hint: "WebP 支持质量调节，适合高压缩率导出。",
  },
  jpg: {
    mimeType: "image/jpeg",
    extension: "jpg",
    label: "JPG",
    usesQuality: true,
    hint: "JPG 支持质量调节；如果原图有透明区域，会自动填充为白色。",
  },
  png: {
    mimeType: "image/png",
    extension: "png",
    label: "PNG",
    usesQuality: false,
    hint: "PNG 为无损导出；浏览器原生通常不支持通过质量滑杆压缩 PNG。",
  },
}

const state = {
  sourceFile: null,
  sourceUrl: "",
  resultBlob: null,
  resultUrl: "",
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB"]
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** power
  return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`
}

function setStatus(message) {
  elements.statusText.textContent = message
}

function revokeUrl(key) {
  if (state[key]) {
    URL.revokeObjectURL(state[key])
    state[key] = ""
  }
}

function getSelectedFormat() {
  return formats[elements.formatSelect.value] || formats.webp
}

function getBaseName(filename) {
  return filename.replace(/\.[^.]+$/, "") || "converted"
}

function describeSizeChange(originalSize, resultSize) {
  if (!Number.isFinite(originalSize) || originalSize <= 0) {
    return "大小未知"
  }

  if (originalSize === resultSize) {
    return "大小接近原图"
  }

  const ratio = Math.round((Math.abs(resultSize - originalSize) / originalSize) * 100)
  return resultSize < originalSize ? `减小 ${ratio}%` : `增大 ${ratio}%`
}

function updateQualityLabel() {
  const format = getSelectedFormat()
  elements.qualityValue.textContent = format.usesQuality ? `${elements.qualityRange.value}%` : "无损"
}

function updateFormatUI() {
  const format = getSelectedFormat()
  elements.qualityRange.disabled = !format.usesQuality
  elements.qualityCard.classList.toggle("is-disabled", !format.usesQuality)
  elements.qualityHint.textContent = format.hint
  elements.resultTitle.textContent = `${format.label} 结果`
  elements.convertBtn.textContent = `转换为 ${format.label}`

  if (!state.resultBlob) {
    elements.downloadBtn.textContent = `下载 ${format.label}`
  }

  updateQualityLabel()
}

function resetResult() {
  revokeUrl("resultUrl")
  state.resultBlob = null
  elements.resultPreview.hidden = true
  elements.resultPreview.removeAttribute("src")
  elements.resultPlaceholder.hidden = false
  elements.resultMeta.textContent = "尚未生成"
  elements.downloadBtn.classList.add("disabled")
  elements.downloadBtn.removeAttribute("href")
  elements.downloadBtn.removeAttribute("download")
  elements.downloadBtn.textContent = `下载 ${getSelectedFormat().label}`
}

function setReadyStatus() {
  const format = getSelectedFormat()
  setStatus(`图片已载入，点击“转换为 ${format.label}”开始处理。`)
}

function clearSource() {
  revokeUrl("sourceUrl")
  state.sourceFile = null
  elements.fileInput.value = ""
  elements.sourcePreview.hidden = true
  elements.sourcePreview.removeAttribute("src")
  elements.sourcePlaceholder.hidden = false
  elements.sourceMeta.textContent = "未选择文件"
  elements.convertBtn.disabled = true
  resetResult()
  setStatus("选择一张图片后开始转换。")
}

function setSourceFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("请选择浏览器可读取的图片文件。")
    return
  }

  revokeUrl("sourceUrl")
  resetResult()

  state.sourceFile = file
  state.sourceUrl = URL.createObjectURL(file)

  elements.sourcePreview.src = state.sourceUrl
  elements.sourcePreview.hidden = false
  elements.sourcePlaceholder.hidden = true
  elements.sourceMeta.textContent = `${file.name} | ${formatBytes(file.size)}`
  elements.convertBtn.disabled = false
  setReadyStatus()
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("图片加载失败，可能是当前浏览器不支持该格式。"))
    image.src = url
  })
}

function buildCanvas(image, format) {
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("无法初始化 Canvas。")
  }

  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  if (format.extension === "jpg") {
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(image, 0, 0)
  return canvas
}

function canvasToBlob(canvas, format, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`当前浏览器不支持导出 ${format.label}。`))
          return
        }

        if (blob.type && blob.type !== format.mimeType) {
          reject(new Error(`当前浏览器不支持导出 ${format.label}。`))
          return
        }

        resolve(blob)
      },
      format.mimeType,
      format.usesQuality ? quality : undefined
    )
  })
}

async function convertImage() {
  if (!state.sourceFile || !state.sourceUrl) {
    setStatus("请先选择图片。")
    return
  }

  const format = getSelectedFormat()
  elements.convertBtn.disabled = true
  elements.convertBtn.textContent = "转换中..."
  setStatus(`正在浏览器本地转换为 ${format.label}，不会上传文件。`)

  try {
    const image = await loadImage(state.sourceUrl)
    const canvas = buildCanvas(image, format)
    const quality = Number(elements.qualityRange.value) / 100
    const blob = await canvasToBlob(canvas, format, quality)
    const baseName = getBaseName(state.sourceFile.name)
    const sizeChange = describeSizeChange(state.sourceFile.size, blob.size)

    revokeUrl("resultUrl")
    state.resultBlob = blob
    state.resultUrl = URL.createObjectURL(blob)

    elements.resultPreview.src = state.resultUrl
    elements.resultPreview.hidden = false
    elements.resultPlaceholder.hidden = true
    elements.resultMeta.textContent = `${format.label} | ${formatBytes(blob.size)} | ${sizeChange}`
    elements.downloadBtn.href = state.resultUrl
    elements.downloadBtn.download = `${baseName}.${format.extension}`
    elements.downloadBtn.textContent = `下载 ${format.label}`
    elements.downloadBtn.classList.remove("disabled")

    setStatus(
      `转换完成：${state.sourceFile.name} -> ${baseName}.${format.extension}，原始 ${formatBytes(
        state.sourceFile.size
      )}，结果 ${formatBytes(blob.size)}。`
    )
  } catch (error) {
    resetResult()
    setStatus(error instanceof Error ? error.message : "转换失败，请换一张图片再试。")
  } finally {
    elements.convertBtn.disabled = !state.sourceFile
    elements.convertBtn.textContent = `转换为 ${getSelectedFormat().label}`
  }
}

function resetResultIfNeeded() {
  if (!state.resultBlob) {
    return
  }

  resetResult()
  if (state.sourceFile) {
    setReadyStatus()
  }
}

function onDrop(event) {
  event.preventDefault()
  elements.dropzone.classList.remove("is-active")
  const [file] = event.dataTransfer.files
  setSourceFile(file)
}

elements.formatSelect.addEventListener("change", () => {
  resetResultIfNeeded()
  updateFormatUI()
  if (state.sourceFile) {
    setReadyStatus()
  } else {
    setStatus("选择一张图片后开始转换。")
  }
})

elements.qualityRange.addEventListener("input", () => {
  updateQualityLabel()
  resetResultIfNeeded()
})

elements.convertBtn.addEventListener("click", convertImage)

elements.dropzone.addEventListener("click", () => {
  elements.fileInput.click()
})

elements.dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault()
    elements.fileInput.click()
  }
})

elements.dropzone.addEventListener("dragenter", (event) => {
  event.preventDefault()
  elements.dropzone.classList.add("is-active")
})

elements.dropzone.addEventListener("dragover", (event) => {
  event.preventDefault()
  elements.dropzone.classList.add("is-active")
})

elements.dropzone.addEventListener("dragleave", () => {
  elements.dropzone.classList.remove("is-active")
})

elements.dropzone.addEventListener("drop", onDrop)

elements.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files
  setSourceFile(file)
})

window.addEventListener("beforeunload", () => {
  revokeUrl("sourceUrl")
  revokeUrl("resultUrl")
})

updateFormatUI()
clearSource()
