import React from 'react'
import './comm-switch.css';
import Style from 'style-it';

import chatIcon from '../../Images/speech-bubble.png';
import groupIcon from '../../Images/group.png';
import videoIcon from '../../Images/video-call.png';
export default function CommSwitch(props) {
  return Style.it(`
    .comm-switch-box{
      background-color: ${props.theme[1]};
    }
    .chat-btn:hover{
      background-color: ${props.theme[4]};
    }
    .group-btn:hover{
      background-color: ${props.theme[4]};
    }
    .video-btn:hover{
      background-color: ${props.theme[4]};
    }
    .chat-btn[comm='1']{
      background-color: ${props.theme[4]};
    }
    .group-btn[comm='2']{
      background-color: ${props.theme[4]};
    }
    .video-btn[comm='3']{
      background-color: ${props.theme[4]};
    }
    #chat-icon{
      filter:${props.theme[5]};
    }
    #group-icon{
      filter:${props.theme[5]};
    }
    #video-icon{
      filter:${props.theme[5]};
    }
  `,
    <div className='comm-switch-box'>
      <button comm={props.comm} onClick={()=>props.setComm(1)} onMouseEnter={()=>props.setCommTooltip(1)} onMouseLeave={()=>props.setCommTooltip(0)} className='chat-btn'>
        <img id='chat-icon' src={chatIcon} alt='img'/>
      </button>
      <button comm={props.comm} onClick={()=>props.setComm(2)} onMouseEnter={()=>props.setCommTooltip(2)} onMouseLeave={()=>props.setCommTooltip(0)} className='group-btn'>
        <img id='group-icon' src={groupIcon} alt='img'/>
      </button>
      {
        props.tabs !==0?  (
          <button comm={props.comm} onClick={()=>props.setComm(3)} onMouseEnter={()=>props.setCommTooltip(3)} onMouseLeave={()=>props.setCommTooltip(0)} className='video-btn'>
            <img id='video-icon' src={videoIcon} alt='img'/>
          </button>
        ) : (
          <button comm={props.comm} disabled={true} onClick={()=>props.setComm(3)} onMouseEnter={()=>props.setCommTooltip(3)} onMouseLeave={()=>props.setCommTooltip(0)} className='video-btn'>
            <img id='video-icon' src={videoIcon} alt='img'/>
          </button>
        ) 
      }
    </div>
  )
}
