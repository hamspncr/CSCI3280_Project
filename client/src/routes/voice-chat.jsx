import { useState } from 'react'

const VoiceChat = () => {
    // Code for WebSocket connection (note 'ws' only works in the server, need to use native WebSocket object for frontend)
    const ws = new WebSocket("ws://localhost:8000")
    ws.addEventListener('open', () => {
        console.log("Connected to server!")
    })

    // Code for form element
    const [text, setText] = useState("")

    const handleSubmit = (e) => {
        e.preventDefault()
        
        // Send message to the server here...
        if (text) {
            ws.send(text)
        }

        setText("")
    }

    const receiveMessage = () => {

    }

    return (
        <>
            <div>
                <form onSubmit={handleSubmit}>
                    <input type="text" value={text} placeholder="Enter text" onChange={e => setText(e.target.value)}/>
                    <button type="submit">Submit</button>
                </form>
                <ul className="sent-messages"></ul>
            </div>
        </>
    )
}

export default VoiceChat