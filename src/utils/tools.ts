export function limitString (str: string, maxLength: number, addDots = true): string {
    if (str.length <= maxLength) {
        return str
    } else {
        if (addDots) {
            return str.slice(0, maxLength) + '...'
        } else {
            return str.slice(0, maxLength)
        }
    }
}