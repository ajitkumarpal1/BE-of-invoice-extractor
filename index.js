require('dotenv').config();
const express = require("express");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const axios = require('axios');
const multer = require("multer");
const path = require("path");
const cors = require("cors")


/* geminiAi stuf */
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { stringify } = require('querystring');
const genAI = new GoogleGenerativeAI(process.env.OPENAI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const app = express();
app.use(cors());
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}.pdf`);
    }
});

const upload = multer({ storage: storage });

app.use(express.static("public"));
app.use(express.json());

app.post('/upload', upload.single('pdf'), async (req, res) => {
    try {
        console.log("==>",req.file.path)
        const filePath = path.resolve(req.file.path); // Resolving the file path
        console.log("Resolved path =", filePath);

        const buffer = fs.readFileSync(filePath);
        const text = await extractTextFromPDF(buffer);
        const result = await classifyInvoiceDetails(text);
        console.log(result.text)
        let data = result.text.replace("```json", "")
            .replace("```", "")
            .replace(/\\n,/g, " ")
            .replace(/\n/g, "")
            .replace(/\\n/g, " ")
        data = data.split("")
        let finalResult = ""
        data.forEach(element => {
            if(element != '"'){
                finalResult += element
            }else{
                finalResult += "🖖"
            }
        });
        finalResult = finalResult.replace(/\🖖/g, '"');
        finalResult = JSON.parse(finalResult)
        res.json(finalResult);
    } catch (error) {
        console.error("Error processing file:", error);
        res.status(500).send("Server error");
    }
});

app.listen(3000, (error) => {
    if (error) {
        console.log("Error starting server:", error);
    } else {
        console.log("Server is running on port 3000");
    }
});

/* PDF Parsing */
async function extractTextFromPDF(buffer) {
    try {
        const data = await pdfParse(buffer);
        return data.text;
    } catch (error) {
        console.error('Error parsing PDF:', error);
    }
}

/* gemini Integration */

async function classifyInvoiceDetails(promtPDF) {
    const prompt = `Extract and classify the following invoice details into this JSON format: 
{
  "customerName": "",
  "customerContactNo": "",
  "customerAddress": "",
  "productsName": [],
  "totalAmount": 0
} \n Data:${promtPDF}`

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return { text }
}