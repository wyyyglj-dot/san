'use client';

import { cn } from '@/lib/utils';
import { CreateHeader } from './create-header';
import { GenerationPreviewArea } from './generation-preview-area';
import { PromptConfigurator } from './prompt-configurator';
import { ModelSettingsPanel } from './model-settings-panel';
import { useCreatePage } from './use-create-page';

export default function CreatePage() {
  const {
    fileInputRef,
    promptTextareaRef,
    remixPromptRef,
    mediaType,
    setMediaType,
    prompt,
    setPrompt,
    creationMode,
    setCreationMode,
    storyboardPrompt,
    setStoryboardPrompt,
    remixUrl,
    setRemixUrl,
    files,
    isDragging,
    compressing,
    displayedGenerations,
    displayedTasks,
    imageChannels,
    selectedImageChannelId,
    setSelectedImageChannelId,
    currentImageModel,
    imageAspectRatio,
    setImageAspectRatio,
    aggregatedImageSizes,
    imageSize,
    setImageSize,
    videoChannels,
    selectedVideoChannelId,
    setSelectedVideoChannelId,
    currentVideoModel,
    videoDuration,
    setVideoDuration,
    videoAspectRatio,
    setVideoAspectRatio,
    selectedStyle,
    setSelectedStyle,
    showStylePanel,
    setShowStylePanel,
    characterCards,
    showCharacterMenu,
    setShowCharacterMenu,
    submitting,
    error,
    keepPrompt,
    setKeepPrompt,
    enhancing,
    modelsLoaded,
    isLimitReached,
    hasNoChannels,
    dailyLimit,
    dailyCount,
    handleFileUpload,
    clearFiles,
    handleEnhancePrompt,
    handleSubmit,
    handleRemoveTask,
    handleRetryTask,
    handleClearGenerations,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePromptChange,
    handleAddCharacter,
  } = useCreatePage();

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-7xl mx-auto">
      <CreateHeader
        mediaType={mediaType}
        onMediaTypeChange={setMediaType}
        dailyLimit={dailyLimit}
        dailyCount={dailyCount}
        isLimitReached={isLimitReached}
        modelsLoaded={modelsLoaded}
        hasNoChannels={hasNoChannels}
      />
      <GenerationPreviewArea
        generations={displayedGenerations}
        tasks={displayedTasks}
        onRemoveTask={handleRemoveTask}
        onRetryTask={handleRetryTask}
        onClear={handleClearGenerations}
      />
      <div className={cn(
        "surface shrink-0 overflow-visible",
        (hasNoChannels || isLimitReached) && "opacity-50 pointer-events-none"
      )}>
        <PromptConfigurator
          mediaType={mediaType}
          creationMode={creationMode}
          onCreationModeChange={setCreationMode}
          prompt={prompt}
          onPromptChange={setPrompt}
          storyboardPrompt={storyboardPrompt}
          onStoryboardPromptChange={setStoryboardPrompt}
          remixUrl={remixUrl}
          onRemixUrlChange={setRemixUrl}
          files={files}
          showFileUpload={mediaType === 'image' ? !!currentImageModel?.features.imageToImage : creationMode === 'normal'}
          fileInputRef={fileInputRef}
          promptTextareaRef={promptTextareaRef}
          remixPromptRef={remixPromptRef}
          onFileUpload={handleFileUpload}
          onClearFiles={clearFiles}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          isDragging={isDragging}
          enhancing={enhancing}
          onEnhance={handleEnhancePrompt}
          characterCards={characterCards}
          showCharacterMenu={showCharacterMenu}
          onShowCharacterMenu={setShowCharacterMenu}
          onAddCharacter={handleAddCharacter}
          onPromptInputChange={handlePromptChange}
        />
        <div className="px-4 pb-4 pt-3 space-y-3">
          <ModelSettingsPanel
            mediaType={mediaType}
            creationMode={creationMode}
            imageChannels={imageChannels}
            selectedImageChannelId={selectedImageChannelId}
            onImageChannelChange={setSelectedImageChannelId}
            currentImageModel={currentImageModel ?? null}
            imageAspectRatio={imageAspectRatio}
            onImageAspectRatioChange={setImageAspectRatio}
            aggregatedImageSizes={aggregatedImageSizes}
            imageSize={imageSize}
            onImageSizeChange={setImageSize}
            videoChannels={videoChannels}
            selectedVideoChannelId={selectedVideoChannelId}
            onVideoChannelChange={setSelectedVideoChannelId}
            currentVideoModel={currentVideoModel ?? null}
            videoDuration={videoDuration}
            onVideoDurationChange={setVideoDuration}
            videoAspectRatio={videoAspectRatio}
            onVideoAspectRatioChange={setVideoAspectRatio}
            selectedStyle={selectedStyle}
            onStyleChange={setSelectedStyle}
            showStylePanel={showStylePanel}
            onShowStylePanelChange={setShowStylePanel}
            keepPrompt={keepPrompt}
            onKeepPromptChange={setKeepPrompt}
            submitting={submitting}
            compressing={compressing}
            onSubmit={handleSubmit}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
