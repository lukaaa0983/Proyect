export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours}h ${minutes}m ${secs}s`;
};

export const isUrl = (text) => {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    return urlRegex.test(text);
};

export const getBuffer = async (url) => {
    try {
        const res = await fetch(url);
        return await res.arrayBuffer();
    } catch (error) {
        throw error;
    }
};
