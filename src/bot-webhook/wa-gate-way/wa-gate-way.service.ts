import { Injectable } from '@nestjs/common';
import { PollDTO, SendFileDTO, SendLocationDTO } from './wa-gate-way.dto';

@Injectable()
export class WaGateWayService {

    async sendLocation({ phone_number, title, latitude, longitude }: SendLocationDTO) {
        try {
            console.info("Mulai mengirim lokasi");

            const url = new URL('/api/sendLocation', process.env.WA_GATE_WAY);

            const payload = {
                chatId: `${phone_number}`,
                latitude: latitude,
                longitude: longitude,
                title: title,
                reply_to: null,
                session: `${process.env.GATEWAY_SESSION}`
            };

            await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                },
                body: JSON.stringify(payload)
            }).then(res => {
                // console.log(res)
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
                .then(data => console.log('Success mengirimkan pesan.'))
                .catch(err => console.error('Error:', err));
        }
        catch (err) {
            console.error(err);
        }
    }

    async sendPoll(phone_number: string, { name, options, multipleAnswer }: PollDTO) {
        try {
            console.info("Mulai mengirim lokasi");

            const url = new URL('/api/sendPoll', process.env.WA_GATE_WAY);

            const payload = {
                chatId: `${phone_number}`,
                poll: {
                    name: name,
                    options: options,
                    multipleAnswer: multipleAnswer
                },
                reply_to: null,
                session: `${process.env.GATEWAY_SESSION}`
            };

            await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                },
                body: JSON.stringify(payload)
            }).then(res => {
                // console.log(res)
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
                .then(data => console.log('Success mengirimkan pesan.'))
                .catch(err => console.error('Error:', err));
        }
        catch (err) {
            console.error(err);
        }
    }

    async sendImage({ phone_number, file, description }: SendFileDTO) {

        const {mimetype, filename, url} = file;

        console.info("Mulai mengirim gambar");
        console.info("Mimetype : ", mimetype);
        console.info("Filename : ", filename);
        console.info("URL : ", url);

        try {
            const urlAPI = new URL('/api/sendImage', process.env.WA_GATE_WAY);

            console.info("URL API : ", urlAPI.toString());

            const payload = {
                chatId: `${phone_number}`,
                file: {
                    mimetype: mimetype,
                    filename: filename,
                    url: url
                },
                reply_to: null,
                caption: description,
                session: `${process.env.GATEWAY_SESSION}`
            };

            await fetch(urlAPI.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                },
                body: JSON.stringify(payload)
            }).then(res => {
                // console.log(res)
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
                .then(data => console.log('Success mengirimkan gambar.'))
                .catch(err => console.error('Error pengiriman gambar : ', err));
        }
        catch (err) {
            console.error(err);
        }
    }

}
