import { Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { Variables } from 'generated/prisma';
import { ChatCompletionResponse, RAGResponse } from './types/aiDemo';

@Injectable()
export class ResponseGeneratorService {

    /**
     * generateAnswer merupakan fungsi untuk menghasilkan jawaban berdasarkan respons yang diberikan, pertanyaan, dan variabel yang tersedia.
     * @param response 
     * @param question 
     * @param variables 
     * @returns 
     */
    async generateAnswer(response: string, question: string, variables: Variables[]): Promise<string> {
        try {
            const url = new URL("/api/generate", `${process.env.AI_GENERATOR}`);

            console.info("Jawaban : ", response);
            console.info("Pertanyaan :", question);


            const getVar = (key, fallback) => {
                const found = variables.find(item => item.name === key);
                return found ? found.content : fallback;
            };

            // const rawPrompt = `${process.env.PROMPT}` || '';
            const rawPrompt = getVar("response_generator_prompt", process.env.PROMPT) || 'Anda adalah asisten yang hanya menjawab berdasarkan informasi yang diberikan.{{nl}}{{nl}}INFORMASI:{{nl}}response_prompt{{nl}}{{nl}}PERTANYAAN:{{nl}}question_prompt{{nl}}{{nl}}JAWABAN:';

            console.info("Raw Prompt : ", rawPrompt);

            const prompt = rawPrompt
                .replace(/{{nl}}/g, '\n')
                .replace(/response_prompt/gi, response)
                .replace(/question_prompt/gi, question);

            console.info("Prompt : ", prompt);

            const payloadData = {
                model: getVar("response_generator_model", process.env.MODEL || "gemma:2b"),
                prompt: prompt,
                stream: false,
                temperature: Number(getVar("response_generator_temperature", process.env.TEMPERATURE)) || 0.7,
                top_p: Number(getVar("response_generator_top_p", process.env.TOP_P)) || 1,
                max_tokens: Number(getVar("response_generator_max_token", process.env.MAX_TOKEN)) || 512,
                frequency_penalty: Number(getVar("response_generator_frequency_penalty", process.env.FREQUENCY_PENALTY)) || 0,
                presence_penalty: Number(getVar("response_generator_presence_penalty", process.env.PRESENCE_PENALTY)) || 0,
                stop: ["\n"]
            };

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                },
                body: JSON.stringify(payloadData)
            });

            if (!res.ok) {
                console.error("Error fetch to API Generator");
                return response;
            }

            const data = await res.json();

            return data.response || response;
        }
        catch (err) {
            console.error("Terjadi error saat mengenerate jawaban");
            return response;
        }
    }

    /**
     * paraphraseText digunakan untuk melakukan parafrase pada teks yang diberikan.
     * @param text Teks yang akan diparafrase.
     * @param paraphrasePrompt Prompt yang digunakan untuk parafrase.
     * @returns Teks yang telah diparafrase.
     */
    async paraphraseText(text: string, paraphrasePrompt: string): Promise<string> {
        try {
            const url = new URL("/api/generate", `${process.env.AI_GENERATOR}`);

            const rawPrompt = `${paraphrasePrompt}` || '';

            const prompt = rawPrompt
                .replace(/{{nl}}/g, '\n')
                .replace(/response_bot/gi, text)

            console.info("Prompt : ", prompt);

            const payloadData = {
                model: process.env.MODEL || "gemma:2b",
                prompt: prompt,
                stream: false,
                temperature: Number(process.env.TEMPERATURE) || 0.7,
                top_p: Number(process.env.TOP_P) || 1,
                max_tokens: Number(process.env.MAX_TOKEN) || 512,
                frequency_penalty: Number(process.env.FREQUENCY_PENALTY) || 0,
                presence_penalty: Number(process.env.PRESENCE_PENALTY) || 0,
                stop: ["\n"]
            }

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                },
                body: JSON.stringify(payloadData)
            });

            if (!res.ok) {
                console.error("Error fetch to API Generator");
                return text;
            }

            const data = await res.json();

            return data.response || text;
        }
        catch (err) {
            console.error("Terjadi error saat mengenerate jawaban");
            return text;
        }
    }

    /**
     * matchQuestion digunakan untuk mencocokkan pertanyaan dengan daftar pertanyaan yang diberikan.
     * @param questionList Daftar pertanyaan yang akan dicocokkan.
     * @param questionMessage Pesan pertanyaan yang akan dicocokkan.
     * @param variables Variabel yang tersedia untuk digunakan dalam pencocokan.
     * @returns Pertanyaan yang cocok atau "TIDAK ADA PERTANYAAN YANG COCOK" jika tidak ada yang cocok.
     */
    async matchQuestion(questionList: string[], questionMessage: string, variables: Variables[]): Promise<string | "TIDAK ADA PERTANYAAN YANG COCOK"> {

        const url = new URL("/api/generate", `${process.env.AI_GENERATOR}`);

        const getVar = (key, fallback) => {
            const found = variables.find(item => item.name === key);
            return found ? found.content : fallback;
        };

        const rawPrompt = getVar("question_matching_prompt", process.env.PROMPT_QUESTION_MATCH) || 'Diberikan:- Pertanyaan pengguna: "PERTANYAAN_PENGGUNA"- Daftar pertanyaan dengan format "Isi Pertanyaan (ID: ID_PERTANYAAN)" yaitu:DAFTAR_PERTANYAAN_QUERY Tugas:1. Bandingkan pertanyaan pengguna dengan setiap pertanyaan dalam daftar.2. Tentukan pertanyaan yang paling mirip.3. Kembalikan **hanya** ID pertanyaan tersebut sebagai string.  Contoh: "12345-abcde-67890" 4. Jika tidak ada pertanyaan yang cukup mirip, kembalikan: "TIDAK ADA PERTANYAAN YANG COCOK" Catatan: - Jawaban **hanya** berupa satu string (ID atau pesan default) tanpa penjelasan, alasan, atau analisis apapun.';

        const daftarPertanyaan = `${questionList.map((item) => (
            `- ${item}`
        )).join('\n\n')
            }`;

        const prompt = rawPrompt
            .replace(/PERTANYAAN_PENGGUNA/gi, questionMessage)
            .replace(/DAFTAR_PERTANYAAN_QUERY/gi, daftarPertanyaan);

        console.info("Prompt : ", prompt);

        const payloadData = {
            model: getVar("response_generator_model", process.env.MODEL || "gemma:2b"),
            prompt: prompt,
            stream: false,
            // temperature: Number(getVar("response_generator_temperature", process.env.TEMPERATURE)) || 0.7,
            // top_p: Number(getVar("response_generator_top_p", process.env.TOP_P)) || 1,
            // max_tokens: Number(getVar("response_generator_max_token", process.env.MAX_TOKEN)) || 512,
            // frequency_penalty: Number(getVar("response_generator_frequency_penalty", process.env.FREQUENCY_PENALTY)) || 0,
            // presence_penalty: Number(getVar("response_generator_presence_penalty", process.env.PRESENCE_PENALTY)) || 0,
            // stop: ["\n"]
        };

        const res = await fetch(url, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
            },
            body: JSON.stringify(payloadData)
        });

        if (!res.ok) {
            console.error("Error fetch to API Generator");
            return "TIDAK ADA PERTANYAAN YANG COCOK";
        }

        const data = await res.json();

        console.info("Response dari API Generator Question Match : ", data);

        return data.response || "TIDAK ADA PERTANYAAN YANG COCOK";

    }

    async matchQuestionV2(questionList: string[], questionMessage: string, variables: Variables[]) : Promise<string | "TIDAK ADA PERTANYAAN YANG COCOK"> {

        const getVar = (key: string, fallback: string): string => {
            const found = variables.find(item => item.name === key);
            return found ? found.content : fallback;
        };

        const userContent = getVar("ai_demo_content_user", 'Format input: Pertanyaan Pengguna: PERTANYAAN_PENGGUNA Daftar Pertanyaan Referensi: Setiap pertanyaan dalam format "ISI PERTANYAAN (ID: ID_PERTANYAAN)" DAFTAR_PERTANYAAN_QUERY Aturan Jawaban: - Jangan berikan penjelasan atau teks tambahan. - Jawaban hanya dalam format:');

        const daftarPertanyaan = `${questionList.map((item) => (
            `- ${item}`
        )).join('\n\n')
            }`;

        const userPrompt = userContent.replace(/PERTANYAAN_PENGGUNA/gi, questionMessage).replace(/DAFTAR_PERTANYAAN_QUERY/gi, daftarPertanyaan);

        const payload = {
            model: getVar("model_ai_demo", "meta/llama-4-maverick-instruct"),
            messages: [
                {
                    role: "system",
                    content : getVar("ai_demo_content_system", "Anda adalah sistem pencocokan pertanyaan berdasarkan kemiripan makna (semantic similarity). Tujuan Anda adalah mencocokkan satu pertanyaan pengguna dengan satu pertanyaan dari daftar referensi yang memiliki makna paling mirip. Langkah-langkah: 1. Bandingkan setiap pertanyaan referensi terhadap pertanyaan pengguna. 2. Hitung dan kembalikan nilai kemiripan makna dalam bentuk persentase (misalnya 87.5%). 3. Pilih hanya **satu pertanyaan** dengan nilai kecocokan tertinggi. 4. Jawaban **wajib menyertakan persentase kecocokan**, walaupun persentasenya rendah (misalnya 35.0%).")
                },
                {
                    role : "user",
                    content : userPrompt
                }
            ],
            stream : getVar("ai_demo_stream", "false") === "false" ? false : true,
            temperature : parseFloat(getVar("ai_demo_temperature", "0.9")),
            max_tokens : parseInt(getVar("ai_demo_max_tokens", "100")),
            top_p : parseInt(getVar("ai_demo_top_p", "1"))
        }

        return await axios.post<ChatCompletionResponse>(`${process.env.AI_DEMO_BASE_URL || "https://dekallm.cloudeka.ai/v1"}/chat/completions`,payload, {
            headers : process.env.AI_DEMO_API_KEY ? {
                Authorization : `Bearer ${process.env.AI_DEMO_API_KEY}`
            } : {}
        }).then((response) => {
            return response.data.choices[0].message.content || "TIDAK ADA PERTANYAAN YANG COCOK"
        }).catch((error : AxiosError) => {
            console.error("Error fetch ai response : ", error.message);

            return "TIDAK ADA PERTANYAAN YANG COCOK"
        })
    }

    async metchQuestionRAG({question, wa_number = null, category = null, variables} : {question : string; wa_number? : string, category? : string, variables : Variables[]}) : Promise<string | null> {

        const baseURL = variables.find((item) => item.name === "RAG_BASE_URL").content;

        const api = axios.create({
            baseURL : baseURL || process.env.RAG_URL || "http://172.22.0.20:5000",
            timeout : 20000
        });

        return api.post<RAGResponse>("/api/search",{
            question,
            wa_number,
            category
        }).then((response) => {
            console.info("Response RAG : ", JSON.stringify(response.data.data.similar_questions));

            const randomIndex = Math.floor(Math.random() * response.data.data.similar_questions[0].answer_id.length);

            return response.data.status === "success" ? response.data.data.similar_questions[0].answer_id[randomIndex] : null
        }).catch((error : AxiosError) => {
            console.error("There is an error when send request to RAG : ", error.message);

            return null;
        })

        
    }

}
