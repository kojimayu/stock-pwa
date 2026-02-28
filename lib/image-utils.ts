/**
 * クライアントサイド画像圧縮ユーティリティ
 * 小さい文字が潰れない解像度（最大1920px）でJPEG圧縮
 */

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const JPEG_QUALITY = 0.82;

/**
 * 画像ファイルを圧縮して返す
 * - 最大1920x1920pxにリサイズ（アスペクト比維持）
 * - JPEG quality 0.82（小文字が読める品質）
 * - 元が小さい場合はリサイズしない
 */
export async function compressImage(file: File): Promise<File> {
    // 画像以外はそのまま返す
    if (!file.type.startsWith("image/")) return file;

    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;

            // リサイズ不要な場合でもJPEG圧縮はかける
            if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                resolve(file);
                return;
            }

            // バイリニア補間（デフォルト）で描画
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }

                    // 圧縮後のファイル名（.jpg拡張子に統一）
                    const baseName = file.name.replace(/\.[^.]+$/, "");
                    const compressed = new File([blob], `${baseName}.jpg`, {
                        type: "image/jpeg",
                        lastModified: Date.now(),
                    });

                    // 圧縮後の方が大きい場合は元ファイルを使用
                    resolve(compressed.size < file.size ? compressed : file);
                },
                "image/jpeg",
                JPEG_QUALITY
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };

        img.src = url;
    });
}

/**
 * 複数画像を並列圧縮
 */
export async function compressImages(files: File[]): Promise<File[]> {
    return Promise.all(files.map(compressImage));
}
