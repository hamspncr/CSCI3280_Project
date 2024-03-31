import { useState, useRef, useEffect } from 'react'

const VoiceChat = () => {
    // Code for WebSocket connection (note 'ws' only works in the server, need to use native WebSocket object for frontend)
    /*
    Legacy code (in case it is needed later)
    const ws = new WebSocket("ws://localhost:8000")
    ws.addEventListener('open', () => {
        console.log("Connected to server!")
    })
    */
    const ws = useRef(null)
    useEffect(() => {
        ws.current = new WebSocket("ws://localhost:8000")
        ws.current.onopen = () => {
            console.log("Connected to server!")
        }

        // If a message is received, append it to the chat room
        ws.current.onmessage = ({data}) => {
            console.log(data)
            const li = document.createElement("li")
            li.textContent = data
            document.querySelector(".sent-messages").appendChild(li)
        }

        // Handle closing of WebSocket
        return () => {
            ws.current.close()
        }
    }, [])

    // Code for form element
    const [text, setText] = useState("")

    const handleSubmit = (e) => {
        e.preventDefault()
        
        // Send message to the server here...
        // Only sends the message if it is not empty
        if (text) {
            ws.current.send(text)
        }

        setText("")
    }

    return (
        <>
            <h1>Send sound data: </h1>
            <button>Click me to mute/unmute</button>
            <hr/>
            <h1>Send messages:</h1>
            <form onSubmit={handleSubmit}>
                <input type="text" value={text} placeholder="Enter text" onChange={e => setText(e.target.value)}/>
                <button type="submit">Send!</button>
            </form>
            <ul className="sent-messages"></ul>
        </>
    )
}

export default VoiceChat