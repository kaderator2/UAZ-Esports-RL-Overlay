import asyncio
import json
import websockets
 
# create handler for each connection
 
localData = {"score" : {"home" : 0, "away": 0}, "games" : ""}

def updateFiles():
    with open('score.txt') as f:
        lines = f.readlines()
    localData["score"]["home"] = lines[0][0]
    localData["score"]["away"] = lines[0][4]
    with open('games.txt') as f:
        lines = f.readlines()
    localData["games"] = lines[0]

updateFiles()
print("~~~STARTING~~~")
print(json.dumps(localData))
print("\n")

async def handler(websocket):
    while True:
        message = await websocket.recv()
        try:
            message = json.loads(str(message))
            if message["msg"] == "send_update":
                updateFiles()
                print(message)
                await websocket.send(json.dumps(localData))
                print("SENT PACKET")
        except:
            print("things got weird :(")
            print(message)
            print(type(message))
            print("we keep trying\n")
            pass

async def main():
    async with websockets.serve(handler, "", 8001):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())