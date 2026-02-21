declare module 'dom-to-image-more' {
    export function toJpeg(node: HTMLElement, options?: any): Promise<string>;
    export function toPng(node: HTMLElement, options?: any): Promise<string>;
    export function toSvg(node: HTMLElement, options?: any): Promise<string>;
    export function toPixelData(node: HTMLElement, options?: any): Promise<Uint8Array>;
    export default { toJpeg, toPng, toSvg, toPixelData };
}
