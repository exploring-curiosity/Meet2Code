import { clientEndpoint } from "../../../config";
const leaveMeet = (e,socket,id) => {
    e.preventDefault();
    socket.emit('leaveRoom', { host: id }, (status) => {
        socket.off();
        window.location.href = clientEndpoint;
    })
}

export {leaveMeet}