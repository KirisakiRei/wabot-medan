/**
 * PengaduanDTO is a Data Transfer Object that represents the structure of a complaint
 * submitted by a user. It includes the complaint text and an array of attachments.
 * * @property {string} complaint - The text of the complaint.
 * * @property {Array} attachment - An array of objects representing the attachments related to the complaint.
 * * Each attachment object contains:
 * *   - {string} file_name - The name of the file.
 * *   - {string} file_path - The path to the file.
 * @example
 * const pengaduan: PengaduanDTO = {
 *   complaint: "This is a sample complaint.",
 *  attachment: [
 *    {
 *     file_name: "screenshot.png",
 *    file_path: "/path/to/screenshot.png"
 *   }
 */
export class PengaduanDTO {
    complaint: string | null;
    attachments: {
        file_name: string;
        file_path: string;
        caption?: string | null;
    }[];
}

/**
 * Pengaduan Response
 */
export class PengaduanResponse {
    status: "success" | "error" | "warning";
    statusCode: number;
    message: string
}