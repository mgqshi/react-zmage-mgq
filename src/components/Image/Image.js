/**
 * 图片层
 * 展示图片, 控制图片尺寸
 **/

// Libs
import classnames from 'classnames';
import React, { Fragment } from 'react'
// Styles
import style from './Image.less'
// Components
import Loading from './Loading';
// Utils
import { Context } from '../context'
import { env } from '@/utils/env'
import {
    scrollWidth,
    checkImageLoadedComplete, appendParams,
    lockTouchInteraction, unlockTouchInteraction,
    withVendorPrefix,
    isInteger, getTargetPage,
} from '@/utils'
import { getCurrentImageStyle, getCoverStyle, getZoomingStyle } from './Image.utils'

var pageX, pageY, initX, initY, isTouch = false;
export default class Image extends React.PureComponent {

    constructor(props, context) {
        super(props)

        // Refs
        this.imageRef = React.createRef()

        // 初始页面高度
        this.initialPageOffset = window.pageYOffset
        // 监听状态
        this.listeningMouseMove = false
        // 图片加载
        this.imageLoadingTimer = null

        this.state = {
            // Loadings State
            isFetching: true,
            invalidate: false,
            // Style
            currentStyle: getCoverStyle(props, context),
            // Flag
            timestamp: null,
            hasMoveStyle: true
        }
    }

    componentDidMount() {
        window.addEventListener('scroll', this.handleScroll)
        window.addEventListener('resize', this.handleResize)
    }
    componentDidUpdate(prevProps) {
        const { show: prevShow, zoom: prevZoom, rotate: prevRotate, page: prevPage } = prevProps
        const { show: currShow, zoom: currZoom, rotate: currRotate, page: currPage } = this.props
        // 状态改变时更新样式 (Page 导致的 src 变化的 update 交给图片自身的 onload 调用)
        if (prevShow!==currShow || prevZoom!==currZoom || prevRotate!==currRotate) {
            // 显示状态切换
            if (!prevShow) {
                // 显示
                this.updateCurrentImageStyle()
                this.handleDetectImageLoadComplete()
                env.isMobile && lockTouchInteraction()
            } else {
                // 隐藏
                this.updateCurrentImageStyle()
                env.isMobile && unlockTouchInteraction()
            }
            // 更新监听状态
            this.updateZoomEventListenerWithState()
        }
        // 切换页面时
        if (prevPage!==currPage) {
            // 显示加载, 并去除加载时间戳
            this.handleImageLoadStart({ timestamp: null })
        }
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize)
        window.removeEventListener('scroll', this.handleScroll)
        window.removeEventListener('mousemove', this.handleMouseMove)
        clearInterval(this.imageLoadingTimer)
    }

    /**
     * 事件监听
     **/
    updateZoomEventListenerWithState = () => {
        const { show, zoom } = this.context
        if (show && zoom && !this.listeningMouseMove) {
            window.addEventListener('mousemove', this.handleMouseMove)
            this.listeningMouseMove = true
        } else {
            window.removeEventListener('mousemove', this.handleMouseMove)
            this.listeningMouseMove = false
        }
    }

    /**
     * 信息更新
     **/
    updateCurrentImageStyle = () => {
        const newStyle = getCurrentImageStyle(this.props, this.context, this.imageRef)
        this.setStyle(newStyle)
    }

    /**
     * 事件响应
     **/
    // 页面事件
    handleResize = () => {
        this.updateCurrentImageStyle()
    }
    handleScroll = () => {
        if (this.imageRef.current) {
            const { show } = this.context
            this.imageRef.current.style.top = `calc(50% + ${show ? 0 : this.initialPageOffset-window.pageYOffset}px)`
        }
    }
    handleClick = () => {
        const { zoom, toggleZoom } = this.context
        zoom && toggleZoom()
    }
    // 鼠标事件
    handleMouseMove = (e) => {
        const zoomingStyle = getZoomingStyle(this.props, this.context, this.imageRef, e)
        this.setStyle(zoomingStyle)
    }
    // 加载事件
    handleImageLoadStart = (state={}) => {
        this.setState({
            isFetching: true,
            invalidate: false,
            ...state,
        }, this.handleDetectImageLoadComplete)
    }
    handleDetectImageLoadComplete = () => {
        clearInterval(this.imageLoadingTimer)
        this.imageLoadingTimer = checkImageLoadedComplete(this.imageRef.current, this.handleImageLoadEnd)
    }
    handleImageLoadEnd = ({ invalidate }={}) => {
        clearInterval(this.imageLoadingTimer)
        this.setState({
            isFetching: false,
            invalidate: invalidate===undefined ? this.state.invalidate : invalidate,
        })
    }
    handleImageLoad = () => {
        this.updateCurrentImageStyle()
    }
    handleImageError = () => {
        this.handleImageLoadEnd({ invalidate: true })
    }
    handleImageAbort = () => {
        this.handleImageLoadEnd({ invalidate: true })
    }
    handleImageReload = () => {
        this.setState({ timestamp: new Date().getTime() })
    }

    /**
     * 手势操作
     */
    startMoveImg(e) {
        this.setState({
            hasMoveStyle: false
        })
        this.touchRange = e.touches[0].pageX
        //双指
        pageX = e.originalEvent.touches[0].pageX;
        pageY = e.originalEvent.touches[0].pageY;
        initX = e.target.offsetLeft;
        initY = e.target.offsetTop;

        if (e.originalEvent.touches.length >= 2) { //判断是否有两个点在屏幕上
          start = e.originalEvent.touches; //得到第一组两个点
        };
        isTouch = true;
        e.preventDefault()
    }

    movingImg(length, e) {
        const { toggleZoom } = this.context
        // 一根 手指 执行 目标元素移动 操作
        if (e.originalEvent.touches.length == 1 && isTouch) {};

        // 2 根 手指执行 目标元素放大操作
        if (e.originalEvent.touches.length >= 2 && isTouch) {
          //得到第二组两个点
          var now = e.originalEvent.touches;
          Math.abs(e.originalEvent.touches[0].pageX-e.originalEvent.touches[1].pageX)
          //当前距离变小， getDistance 是勾股定理的一个方法
          if(this.getDistance(now[0], now[1]) < this.getDistance(start[0], start[1])){
            toggleZoom()
            console.log('缩小')
          }else{
            toggleZoom()
            console.log('放大')
          };
        };

        let moveDirection = this.touchRange - e.touches[0].pageX // 当滑动到边界时，再滑动会没有效果
        if ((this.count === 0 && moveDirection < 0) || (this.count === length - 1 && moveDirection > 0)) {
            return
        }
    }

    endMoveImg(length, itemImages, e){
        const { toPrevPage, toNextPage } = this.context
        this.setState({
            hasMoveStyle: true
        })
        isTouch = false;
        if (this.touchRange - e.changedTouches[0].pageX > 100) {
            toNextPage()
        } else if (this.touchRange - e.changedTouches[0].pageX < -100) {
            toPrevPage()
        }
    }

    getDistance(p1, p2){
        var x = p2.pageX - p1.pageX,
        y = p2.pageY - p1.pageY;
        return Math.sqrt((x * x) + (y * y));
    };

    /**
     * 样式应用
     **/
    setStyle = (newStyle) => {
        this.setState({
            currentStyle: newStyle
        })
    }
    getStyle = (direction, index) => {
        const { loop, animate, set, show, zoom, page, pageIsCover } = this.context
        const { isFetching, invalidate, currentStyle, timestamp } = this.state
        // 获取动画配置
        let offset=0, overflow=0, transform, clipPath, opacity, zIndex, pointerEvents
        const flipAnim = set.length>=3 ? animate.flip : 'fade'
        const isFade = flipAnim==='fade'
        const isCrossFade = flipAnim==='crossFade'
        isCrossFade && (offset = 30)
        const isSwipe = flipAnim==='swipe'
        isSwipe && (offset = scrollWidth())
        const isZoom = flipAnim==='zoom'
        isZoom && (overflow = 0.08)
        // 计算样式
        switch (direction) {
            case 'prev':
                transform = `translate3d(-50%, -50%, 0) translate3d(${currentStyle.x+offset}px, ${currentStyle.y}px, 0px) scale3d(${currentStyle.scale+overflow}, ${currentStyle.scale+overflow}, 1) rotate3d(0, 0, 1, ${currentStyle.rotate}deg)`
                opacity = (isFade || isCrossFade || isZoom) ? 0 : 1
                zIndex = 20
                pointerEvents = 'none'
                break
            case 'curr':
                transform = `translate3d(-50%, -50%, 0) translate3d(${currentStyle.x}px, ${currentStyle.y}px, 0px) scale3d(${currentStyle.scale}, ${currentStyle.scale}, 1) rotate3d(0, 0, 1, ${currentStyle.rotate}deg)`
                // clipPath = currentStyle.radius ? `inset(0% 0% 0% 0% round ${currentStyle.radius/currentStyle.scale}px)` : `inset(0% 0% 0% 0% round 0)`
                opacity = currentStyle.opacity
                zIndex = 10
                pointerEvents = 'initial'
                break
            case 'next':
                transform = `translate3d(-50%, -50%, 0) translate3d(${currentStyle.x-offset}px, ${currentStyle.y}px, 0px) scale3d(${currentStyle.scale+overflow}, ${currentStyle.scale+overflow}, 1) rotate3d(0, 0, 1, ${currentStyle.rotate}deg)`
                opacity = (isFade || isCrossFade || isZoom) ? 0 : 1
                zIndex = 20
                pointerEvents = 'none'
                break
        }
        return {
            ...withVendorPrefix({ transform }),
            opacity: invalidate ? 0 : opacity,
            cursor: zoom ? 'zoom-out' : 'initial',
            zIndex,
            pointerEvents,
            ...set[index].style,
        }
    }

    render() {

        const { loop, set, show, zoom, page, pageIsCover } = this.context
        const { isFetching, invalidate, currentStyle, timestamp } = this.state

        const prevIndex = getTargetPage(page, set.length, 'prev', { loop })
        const showPrev = show && isInteger(prevIndex) && set.length>1 && !zoom
        const prevStyle = showPrev && this.getStyle('prev', prevIndex)
        const prevClass = showPrev && classnames(style.imageLayer, set[prevIndex].className, {
            [style.zooming]: zoom,
            [style.invalidate]: invalidate,
        })

        const currIndex = page
        const currStyle = this.getStyle('curr', currIndex)
        const currClass = classnames(style.imageLayer, style.curr, set[page].className, {
            [style.zooming]: zoom,
            [style.invalidate]: invalidate,
        })

        const nextIndex = getTargetPage(page, set.length, 'next', { loop })
        const showNext = show && isInteger(nextIndex) && prevIndex!==nextIndex && set.length>1 && !zoom
        const nextStyle = showNext && this.getStyle('next', nextIndex)
        const nextClass = showNext && classnames(style.imageLayer, set[nextIndex].className, {
            [style.zooming]: zoom,
            [style.invalidate]: invalidate,
        })

        return (
            <Fragment>

                {/*加载 (仅在默认图片非封面, 或图片不可用时显示)*/}
                <Loading
                    show={show && (!pageIsCover || invalidate)}
                    load={isFetching}
                    invalidate={invalidate}
                    onReload={this.handleImageReload}
                />

                {/*图片*/}
                {
                    showPrev &&
                    <img
                        key={`${prevIndex}-${set[prevIndex].src}`}
                        id="zmageImage-prev"
                        className={prevClass}
                        style={prevStyle}
                        src={set[prevIndex].src}
                        alt={set[prevIndex].alt}
                    />
                }
                <img
                    key={`${currIndex}-${set[currIndex].src}`}
                    id="zmageImage"
                    className={currClass}
                    style={currStyle}
                    src={appendParams(set[currIndex].src, { t: timestamp })}
                    alt={set[currIndex].alt}
                    ref={this.imageRef}
                    onLoad={this.handleImageLoad}
                    onError={this.handleImageError}
                    onAbort={this.handleImageAbort}
                    onClick={this.handleClick}
                    onTouchStart={this.startMoveImg.bind(this)}
                    onTouchMove={this.movingImg.bind(this,set.length)}
                    onTouchEnd={this.endMoveImg.bind(this,set.length, set)}
                />
                {
                    showNext &&
                    <img
                        key={`${nextIndex}-${set[nextIndex].src}`}
                        id="zmageImage-next"
                        className={nextClass}
                        style={nextStyle}
                        src={set[nextIndex].src}
                        alt={set[nextIndex].alt}
                    />
                }

            </Fragment>
        )
    }
}

Image.contextType = Context